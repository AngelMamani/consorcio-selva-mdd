import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import type { UserRole } from '@/domain/value-objects/UserRole'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { isUserRole } from '@/domain/value-objects/UserRole'

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

    const displayName = request.displayName?.trim()
    if (request.displayName !== undefined && !displayName) {
      throw new ValidationError('El nombre no puede estar vacío')
    }
    if (displayName && displayName.length > 120) {
      throw new ValidationError('El nombre es demasiado largo')
    }

    if (displayName && displayName !== existing.displayName) {
      await this.authRepository.updateManagedUserDisplayName({
        userId: request.userId,
        displayName,
      })
    }

    const shouldPatchRoleOrActive =
      request.role !== undefined || request.active !== undefined

    if (shouldPatchRoleOrActive) {
      return this.userRepository.update(request.userId, {
        role: request.role,
        active: request.active,
      })
    }

    const synced = await this.userRepository.getById(request.userId)
    if (!synced) {
      throw new NotFoundError('Usuario no encontrado tras sincronizar')
    }
    return synced
  }
}
