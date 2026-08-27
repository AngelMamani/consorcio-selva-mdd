import {
  groupUsersByAccessDni,
  pickCanonicalUser,
  uniqueUsersByAccessDni,
  type User,
} from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import type { Personal } from '@/domain/entities/Personal'
import { personalFullName, personalRoleIds } from '@/domain/entities/Personal'
import type { OperationalRoleRepository } from '@/domain/repositories/OperationalRoleRepository'
import type { PersonalRepository } from '@/domain/repositories/PersonalRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import { UnauthorizedError } from '@/domain/errors/DomainError'
import type { ProvisionElectricistaTechniciansUseCase } from '@/domain/usecases/users/ProvisionElectricistaTechniciansUseCase'
import type { UpdateUserUseCase } from '@/domain/usecases/users/UpdateUserUseCase'
import { DNI_PATTERN, digitsOnly } from '@/domain/value-objects/Dni'
import {
  assignedUserRoles,
  isUserRole,
  type UserRole,
} from '@/domain/value-objects/UserRole'

export interface SyncHrAccountsResult {
  users: User[]
  people: Personal[]
}

function sameRoleSet(user: User, codes: UserRole[]): boolean {
  const current = assignedUserRoles(user)
  if (current.length !== codes.length) return false
  return codes.every((code) => current.includes(code))
}

function operationalCodes(
  person: Personal,
  rolesById: Map<string, { code: string }>,
  rolesByCode: Map<string, { code: string }>,
): UserRole[] {
  const codes: UserRole[] = []
  for (const roleId of personalRoleIds(person)) {
    const operationalRole = rolesById.get(roleId) ?? rolesByCode.get(roleId)
    if (operationalRole && isUserRole(operationalRole.code)) {
      if (!codes.includes(operationalRole.code)) {
        codes.push(operationalRole.code)
      }
    }
  }
  return codes
}

export class SyncHrAccountsUseCase {
  private readonly personalRepository: PersonalRepository
  private readonly userRepository: UserRepository
  private readonly operationalRoleRepository: OperationalRoleRepository
  private readonly provisionUseCase: ProvisionElectricistaTechniciansUseCase
  private readonly updateUserUseCase: UpdateUserUseCase

  constructor(
    personalRepository: PersonalRepository,
    userRepository: UserRepository,
    operationalRoleRepository: OperationalRoleRepository,
    provisionUseCase: ProvisionElectricistaTechniciansUseCase,
    updateUserUseCase: UpdateUserUseCase,
  ) {
    this.personalRepository = personalRepository
    this.userRepository = userRepository
    this.operationalRoleRepository = operationalRoleRepository
    this.provisionUseCase = provisionUseCase
    this.updateUserUseCase = updateUserUseCase
  }

  async execute(actor: User): Promise<SyncHrAccountsResult> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede sincronizar cuentas',
      )
    }

    const [people, users, operationalRoles] = await Promise.all([
      this.personalRepository.listAll(),
      this.userRepository.listAll(),
      this.operationalRoleRepository.listAll(),
    ])

    const rolesById = new Map(operationalRoles.map((item) => [item.id, item]))
    const rolesByCode = new Map(
      operationalRoles.map((item) => [item.code, item]),
    )
    const grouped = groupUsersByAccessDni(users)

    await this.deactivateRetired(actor, people, grouped)
    await this.collapseDuplicateAccounts(actor, grouped)

    const pending: Personal[] = []
    for (const person of people) {
      if (person.condicion === 'RETIRADO') continue
      const dni = digitsOnly(person.dni)
      if (!DNI_PATTERN.test(dni)) continue

      const codes = operationalCodes(person, rolesById, rolesByCode)
      if (codes.length === 0) continue

      const existing = pickCanonicalUser(grouped.get(dni) ?? [])
      const name = personalFullName(person) || `USUARIO ${dni}`
      if (
        existing &&
        existing.displayName === name &&
        sameRoleSet(existing, codes)
      ) {
        continue
      }
      pending.push(person)
    }

    for (const person of pending) {
      await this.provisionUseCase
        .ensureForPerson(actor, person)
        .catch(() => undefined)
    }

    const nextUsers =
      pending.length > 0 ? await this.userRepository.listAll() : users
    return {
      users: uniqueUsersByAccessDni(nextUsers),
      people,
    }
  }

  private async deactivateRetired(
    actor: User,
    people: Personal[],
    grouped: Map<string, User[]>,
  ): Promise<void> {
    for (const person of people) {
      if (person.condicion !== 'RETIRADO') continue
      const dni = digitsOnly(person.dni)
      if (!DNI_PATTERN.test(dni)) continue
      for (const account of grouped.get(dni) ?? []) {
        if (!account.active || account.id === actor.id) continue
        await this.updateUserUseCase
          .execute(actor, { userId: account.id, active: false })
          .catch(() => undefined)
      }
    }
  }

  private async collapseDuplicateAccounts(
    actor: User,
    grouped: Map<string, User[]>,
  ): Promise<void> {
    for (const group of grouped.values()) {
      if (group.length < 2) continue
      const canonical = pickCanonicalUser(group)
      if (!canonical) continue
      for (const extra of group) {
        if (extra.id === canonical.id || extra.id === actor.id) continue
        if (!extra.active) continue
        await this.updateUserUseCase
          .execute(actor, { userId: extra.id, active: false })
          .catch(() => undefined)
      }
    }
  }
}
