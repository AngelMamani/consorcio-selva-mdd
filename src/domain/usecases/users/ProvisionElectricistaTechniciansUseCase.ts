import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { OperationalRoleRepository } from '@/domain/repositories/OperationalRoleRepository'
import type { PersonalRepository } from '@/domain/repositories/PersonalRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { Personal } from '@/domain/entities/Personal'
import { personalFullName } from '@/domain/entities/Personal'
import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import { DNI_PATTERN, digitsOnly } from '@/domain/value-objects/Dni'
import { DEFAULT_TEMPORARY_PASSWORD } from '@/domain/value-objects/PasswordPolicy'
import {
  isElectricistaTechnicianCargo,
  technicianEmailFromDni,
} from '@/domain/value-objects/TechnicianLogin'
import { isUserRole, UserRole } from '@/domain/value-objects/UserRole'
import { UnauthorizedError } from '@/domain/errors/DomainError'
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

let provisionQueue: Promise<ProvisionElectricistaResult> | null = null

function isAlreadyExistsMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('ya está registrado') ||
    normalized.includes('ya existe un usuario') ||
    normalized.includes('already-exists')
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

    const runNext = () => this.run(actor, onProgress)
    const queued = (provisionQueue ?? Promise.resolve())
      .catch(() => undefined)
      .then(runNext)
    provisionQueue = queued
    void queued.finally(() => {
      if (provisionQueue === queued) provisionQueue = null
    })
    return queued
  }

  async ensureForPerson(actor: User, person: Personal): Promise<void> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede sincronizar cuentas de acceso',
      )
    }
    if (person.condicion === 'RETIRADO' || !person.roleId) return

    const dni = digitsOnly(person.dni)
    if (!DNI_PATTERN.test(dni)) return

    const operationalRole = await this.operationalRoleRepository.getById(
      person.roleId,
    )
    if (!operationalRole || !isUserRole(operationalRole.code)) return

    const targetRole = operationalRole.code
    const name = personalFullName(person) || `USUARIO ${dni}`
    const existing = await this.userRepository.findByDni(dni)

    if (existing) {
      await this.updateUserUseCase.execute(actor, {
        userId: existing.id,
        displayName: name,
        role: targetRole,
        dni,
      })
      return
    }

    await this.authRepository.createManagedUser({
      email: technicianEmailFromDni(dni),
      displayName: name,
      role: targetRole,
      dni,
    })
  }

  private async run(
    actor: User,
    onProgress?: ProvisionProgress,
  ): Promise<ProvisionElectricistaResult> {
    const [people, users, tecnicoRole] = await Promise.all([
      this.personalRepository.listAll(),
      this.userRepository.listAll(),
      this.operationalRoleRepository.getByCode(UserRole.Tecnico),
    ])

    const usersByDni = new Map(
      users
        .filter((item) => item.dni)
        .map((item) => [item.dni, item] as const),
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
        DNI_PATTERN.test(dni) && !usersByDni.has(dni) && shouldBeTechnician
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
        const created = await this.authRepository.createManagedUser({
          email: technicianEmailFromDni(dni),
          displayName: name || `TÉCNICO ${dni}`,
          role: UserRole.Tecnico,
          dni,
        })
        usersByDni.set(dni, {
          id: created.userId,
          email: technicianEmailFromDni(dni),
          displayName: name,
          dni,
          role: UserRole.Tecnico,
          theme: actor.theme,
          mustChangePassword: true,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
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
