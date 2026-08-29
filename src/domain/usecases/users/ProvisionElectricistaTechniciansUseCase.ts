import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { OperationalRoleRepository } from '@/domain/repositories/OperationalRoleRepository'
import type { PersonalRepository } from '@/domain/repositories/PersonalRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { Personal } from '@/domain/entities/Personal'
import { personalFullName, personalRoleIds } from '@/domain/entities/Personal'
import {
  pickCanonicalUser,
  uniqueUsersByAccessDni,
  userAccessDni,
  type User,
} from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import { DNI_PATTERN, digitsOnly } from '@/domain/value-objects/Dni'
import { DEFAULT_TEMPORARY_PASSWORD } from '@/domain/value-objects/PasswordPolicy'
import {
  isElectricistaTechnicianCargo,
  technicianEmailFromDni,
} from '@/domain/value-objects/TechnicianLogin'
import { isUserRole, UserRole } from '@/domain/value-objects/UserRole'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import type { UpdateUserUseCase } from '@/domain/usecases/users/UpdateUserUseCase'

export interface ProvisionElectricistaFailure {
  dni: string
  name: string
  error: string
}

export interface ProvisionElectricistaResult {
  scanned: number
  created: number
  skipped: number
  rolesAssigned: number
  failed: ProvisionElectricistaFailure[]
  temporaryPassword: string
}

export type ProvisionProgress = (done: number, total: number) => void

let provisionChain: Promise<unknown> = Promise.resolve()

function enqueueProvision<T>(work: () => Promise<T>): Promise<T> {
  const next = provisionChain.catch(() => undefined).then(work)
  provisionChain = next
  return next as Promise<T>
}

function isAlreadyExistsMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('ya está registrado') ||
    normalized.includes('ya existe un usuario') ||
    normalized.includes('already-exists') ||
    normalized.includes('el correo ya está registrado')
  )
}

export class ProvisionElectricistaTechniciansUseCase {
  private readonly authRepository: AuthRepository
  private readonly userRepository: UserRepository
  private readonly personalRepository: PersonalRepository
  private readonly operationalRoleRepository: OperationalRoleRepository
  private readonly updateUserUseCase: UpdateUserUseCase

  constructor(
    authRepository: AuthRepository,
    userRepository: UserRepository,
    personalRepository: PersonalRepository,
    operationalRoleRepository: OperationalRoleRepository,
    updateUserUseCase: UpdateUserUseCase,
  ) {
    this.authRepository = authRepository
    this.userRepository = userRepository
    this.personalRepository = personalRepository
    this.operationalRoleRepository = operationalRoleRepository
    this.updateUserUseCase = updateUserUseCase
  }

  async execute(
    actor: User,
    onProgress?: ProvisionProgress,
  ): Promise<ProvisionElectricistaResult> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede crear cuentas de técnicos',
      )
    }

    return enqueueProvision(() => this.run(onProgress))
  }

  async ensureForPerson(actor: User, person: Personal): Promise<void> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede sincronizar cuentas de acceso',
      )
    }

    return enqueueProvision(() => this.ensureForPersonLocked(actor, person))
  }

  private async ensureForPersonLocked(
    actor: User,
    person: Personal,
  ): Promise<void> {
    if (person.condicion === 'RETIRADO') return

    const dni = digitsOnly(person.dni)
    if (!DNI_PATTERN.test(dni)) return

    const roleIds = personalRoleIds(person)
    if (roleIds.length === 0) return

    const codes: UserRole[] = []
    for (const roleId of roleIds) {
      const operationalRole =
        (await this.operationalRoleRepository.getById(roleId)) ??
        (await this.operationalRoleRepository.getByCode(roleId))
      if (operationalRole && isUserRole(operationalRole.code)) {
        if (!codes.includes(operationalRole.code)) {
          codes.push(operationalRole.code)
        }
      }
    }
    const name = personalFullName(person) || `USUARIO ${dni}`
    if (codes.length === 0) {
      throw new ValidationError(
        `Los roles de ${name} no son de acceso (ADMINISTRADOR/TÉCNICO). Revisa Sistema → Roles.`,
      )
    }

    const targetRole =
      codes.includes(UserRole.SuperAdministrador)
        ? UserRole.SuperAdministrador
        : codes.includes(UserRole.Administrador)
          ? UserRole.Administrador
          : UserRole.Tecnico
    const existing = await this.findAccountForDni(dni)

    if (existing) {
      await this.updateCanonicalAccount(actor, existing, {
        displayName: name,
        role: targetRole,
        roles: codes,
        dni,
      })
      return
    }

    try {
      await this.authRepository.createManagedUser({
        email: technicianEmailFromDni(dni),
        displayName: name,
        role: targetRole,
        dni,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!isAlreadyExistsMessage(message)) throw error
    }

    const created = await this.findAccountForDni(dni)
    if (!created) return
    await this.updateCanonicalAccount(actor, created, {
      displayName: name,
      role: targetRole,
      roles: codes,
      dni,
    })
  }

  private async findAccountForDni(dni: string): Promise<User | null> {
    const [byDni, byEmail] = await Promise.all([
      this.userRepository.listByDni(dni),
      this.userRepository.findByEmail(technicianEmailFromDni(dni)),
    ])
    const matches = [...byDni]
    if (byEmail && !matches.some((item) => item.id === byEmail.id)) {
      matches.push(byEmail)
    }
    return pickCanonicalUser(matches)
  }

  private async updateCanonicalAccount(
    actor: User,
    canonical: User,
    patch: {
      displayName: string
      role: UserRole
      roles: UserRole[]
      dni: string
    },
  ): Promise<void> {
    await this.updateUserUseCase.execute(actor, {
      userId: canonical.id,
      displayName: patch.displayName,
      role: patch.role,
      roles: patch.roles,
      dni: patch.dni,
    })

    const extras = await this.userRepository.listByDni(patch.dni)
    const byEmail = await this.userRepository.findByEmail(
      technicianEmailFromDni(patch.dni),
    )
    const all = [...extras]
    if (byEmail && !all.some((item) => item.id === byEmail.id)) {
      all.push(byEmail)
    }

    for (const extra of all) {
      if (extra.id === canonical.id || extra.id === actor.id) continue
      if (!extra.active) continue
      await this.updateUserUseCase
        .execute(actor, { userId: extra.id, active: false })
        .catch(() => undefined)
    }
  }

  private async run(
    onProgress?: ProvisionProgress,
  ): Promise<ProvisionElectricistaResult> {
    const [people, users, tecnicoRole] = await Promise.all([
      this.personalRepository.listAll(),
      this.userRepository.listAll(),
      this.operationalRoleRepository.getByCode(UserRole.Tecnico),
    ])

    const knownDnis = new Set(
      uniqueUsersByAccessDni(users)
        .map((item) => userAccessDni(item))
        .filter(Boolean),
    )

    const electricistas = people.filter(
      (person) =>
        isElectricistaTechnicianCargo(person.cargoName) &&
        person.condicion !== 'RETIRADO',
    )

    const result: ProvisionElectricistaResult = {
      scanned: electricistas.length,
      created: 0,
      skipped: 0,
      rolesAssigned: 0,
      failed: [],
      temporaryPassword: DEFAULT_TEMPORARY_PASSWORD,
    }

    const missing = electricistas.filter((person) => {
      const dni = digitsOnly(person.dni)
      const shouldBeTechnician =
        !person.roleId || person.roleId === tecnicoRole?.id
      return (
        DNI_PATTERN.test(dni) && !knownDnis.has(dni) && shouldBeTechnician
      )
    })

    if (missing.length === 0) {
      result.skipped = electricistas.length
      return result
    }

    onProgress?.(0, missing.length)

    for (let index = 0; index < missing.length; index += 1) {
      const person = missing[index]
      const name = personalFullName(person)
      const dni = digitsOnly(person.dni)

      try {
        const existing = await this.findAccountForDni(dni)
        if (existing) {
          knownDnis.add(dni)
          result.skipped += 1
          continue
        }

        await this.authRepository.createManagedUser({
          email: technicianEmailFromDni(dni),
          displayName: name || `TÉCNICO ${dni}`,
          role: UserRole.Tecnico,
          dni,
        })
        knownDnis.add(dni)
        result.created += 1
        result.rolesAssigned += await this.assignTechnicianRole(
          person,
          tecnicoRole?.id ?? '',
          tecnicoRole?.name ?? '',
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'No se pudo crear la cuenta'
        if (isAlreadyExistsMessage(message)) {
          knownDnis.add(dni)
          result.skipped += 1
        } else {
          result.failed.push({ dni: dni || person.dni, name, error: message })
        }
      } finally {
        onProgress?.(index + 1, missing.length)
      }
    }

    result.skipped += electricistas.length - missing.length
    return result
  }

  private async assignTechnicianRole(
    person: Personal,
    roleId: string,
    roleName: string,
  ): Promise<number> {
    if (!roleId || person.roleId) return 0
    await this.personalRepository.update(person.id, {
      nombres: person.nombres,
      apellidoPaterno: person.apellidoPaterno,
      apellidoMaterno: person.apellidoMaterno,
      dni: person.dni,
      cargoId: person.cargoId,
      cargoName: person.cargoName,
      localidadId: person.localidadId,
      localidadName: person.localidadName,
      condicion: person.condicion,
      roleId,
      roleName,
      createdById: person.createdById,
      createdByName: person.createdByName,
    })
    return 1
  }
}
