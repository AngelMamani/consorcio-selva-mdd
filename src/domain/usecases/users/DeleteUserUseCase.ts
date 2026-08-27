import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { PersonalRepository } from '@/domain/repositories/PersonalRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import { hasAssignedRole, UserRole } from '@/domain/value-objects/UserRole'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export class DeleteUserUseCase {
  private readonly authRepository: AuthRepository
  private readonly userRepository: UserRepository
  private readonly personalRepository: PersonalRepository

  constructor(
    authRepository: AuthRepository,
    userRepository: UserRepository,
    personalRepository: PersonalRepository,
  ) {
    this.authRepository = authRepository
    this.userRepository = userRepository
    this.personalRepository = personalRepository
  }

  async execute(
    actor: User,
    userId: string,
    options: { skipClearRoles?: boolean } = {},
  ): Promise<void> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede eliminar cuentas')
    }

    const targetId = userId.trim()
    if (!targetId) throw new ValidationError('Usuario inválido')
    if (targetId === actor.id) {
      throw new ValidationError('No puedes eliminar tu propia cuenta')
    }

    const target = await this.userRepository.getById(targetId)
    if (!target) throw new NotFoundError('Usuario no encontrado')

    if (
      hasAssignedRole(target, UserRole.SuperAdministrador) &&
      actor.role !== UserRole.SuperAdministrador
    ) {
      throw new UnauthorizedError(
        'Solo el Super Administrador puede eliminar esa cuenta',
      )
    }

    const privileged =
      hasAssignedRole(target, UserRole.Administrador) ||
      hasAssignedRole(target, UserRole.SuperAdministrador)
    if (privileged) {
      const all = await this.userRepository.listAll()
      const others = all.filter(
        (item) =>
          item.id !== target.id &&
          item.active &&
          (hasAssignedRole(item, UserRole.Administrador) ||
            hasAssignedRole(item, UserRole.SuperAdministrador)),
      )
      if (others.length === 0) {
        throw new ValidationError(
          'Debe quedar al menos un administrador activo',
        )
      }
    }

    if (!options.skipClearRoles && target.dni) {
      const person = await this.personalRepository.findByDni(target.dni)
      if (person) {
        await this.personalRepository.assignRoles(person.id, [])
      }
    }

    await this.authRepository.deleteManagedUser(targetId)
  }
}
