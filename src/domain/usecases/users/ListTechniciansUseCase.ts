import type { UserRepository } from '@/domain/repositories/UserRepository'
import { uniqueUsersByAccessDni, type User } from '@/domain/entities/User'
import { hasAssignedRole, UserRole } from '@/domain/value-objects/UserRole'
import { UnauthorizedError } from '@/domain/errors/DomainError'

/** Lista técnicos activos (admin y técnicos pueden usarlo para asignar carpetas). */
export class ListTechniciansUseCase {
  private readonly userRepository: UserRepository

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository
  }

  async execute(actor: User): Promise<User[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    const users = await this.userRepository.listTechnicians()
    return uniqueUsersByAccessDni(users)
      .filter((user) => hasAssignedRole(user, UserRole.Tecnico) && user.active)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
  }
}
