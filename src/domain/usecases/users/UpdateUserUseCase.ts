import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import { UserRole, isUserRole } from '@/domain/value-objects/UserRole'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export interface UpdateUserRequest {
  userId: string
  displayName?: string
  role?: UserRole
  active?: boolean
}

export class UpdateUserUseCase {
  private readonly authRepository: AuthRepository
  private readonly userRepository: UserRepository

  constructor(authRepository: AuthRepository, userRepository: UserRepository) {
    this.authRepository = authRepository
    this.userRepository = userRepository
  }

  async execute(actor: User, request: UpdateUserRequest): Promise<User> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede editar usuarios')
    }

    const existing = await this.userRepository.getById(request.userId)
    if (!existing) {
      throw new NotFoundError('Usuario no encontrado')
    }

    if (request.role !== undefined && !isUserRole(request.role)) {
      throw new ValidationError('Rol inválido')
    }

    if (actor.id === request.userId && request.active === false) {
      throw new ValidationError('No puedes desactivar tu propia cuenta')
    }

    const nextRole = request.role
    const roleChanged =
      nextRole !== undefined && nextRole !== existing.role

    if (roleChanged && actor.id === request.userId) {
      throw new ValidationError('No puedes cambiar tu propio rol')
    }

    if (
      roleChanged &&
      existing.role === UserRole.Administrador &&
      nextRole !== UserRole.Administrador
    ) {
      const all = await this.userRepository.listAll()
      const otherActiveAdmins = all.filter(
        (item) =>
          item.id !== existing.id &&
          item.role === UserRole.Administrador &&
          item.active,
      )
      if (otherActiveAdmins.length === 0) {
        throw new ValidationError(
          'Debe quedar al menos un administrador activo',
        )
      }
    }

    const displayName = request.displayName?.trim()
    if (request.displayName !== undefined && !displayName) {
      throw new ValidationError('El nombre no puede estar vacío')
    }
    if (displayName && displayName.length > 120) {
      throw new ValidationError('El nombre es demasiado largo')
    }

    const nameChanged =
      Boolean(displayName) && displayName !== existing.displayName

    if (nameChanged && displayName) {
      await this.authRepository.updateManagedUserDisplayName({
        userId: request.userId,
        displayName,
      })
    }

    const shouldPatch =
      nameChanged || roleChanged || request.active !== undefined

    if (!shouldPatch) {
      return existing
    }

    return this.userRepository.update(request.userId, {
      ...(nameChanged ? { displayName } : {}),
      ...(request.role !== undefined ? { role: request.role } : {}),
      ...(request.active !== undefined ? { active: request.active } : {}),
    })
  }
}
