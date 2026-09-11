import type { UserRepository } from '@/domain/repositories/UserRepository'
import { uniqueUsersByAccessDni, type User } from '@/domain/entities/User'
import { hasAssignedRole, UserRole } from '@/domain/value-objects/UserRole'
import { UnauthorizedError } from '@/domain/errors/DomainError'

const CACHE_TTL_MS = 60_000

let cachedAt = 0
let cachedActorId = ''
let cachedTechnicians: User[] | null = null

/** Lista técnicos activos (admin y técnicos pueden usarlo para asignar carpetas). */
export class ListTechniciansUseCase {
  private readonly userRepository: UserRepository

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository
  }

  async execute(actor: User, options?: { bypassCache?: boolean }): Promise<User[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    const now = Date.now()
    if (
      !options?.bypassCache &&
      cachedTechnicians &&
      cachedActorId === actor.id &&
      now - cachedAt < CACHE_TTL_MS
    ) {
      return cachedTechnicians
    }

    const users = await this.userRepository.listTechnicians()
    const next = uniqueUsersByAccessDni(users)
      .filter((user) => hasAssignedRole(user, UserRole.Tecnico) && user.active)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))

    cachedTechnicians = next
    cachedAt = now
    cachedActorId = actor.id
    return next
  }
}

/** Invalida la caché tras crear/editar cuentas o sync HR. */
export function invalidateTechniciansCache(): void {
  cachedTechnicians = null
  cachedAt = 0
  cachedActorId = ''
}
