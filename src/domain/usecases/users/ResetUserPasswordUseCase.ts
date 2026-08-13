import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export interface ResetUserPasswordResult {
  user: User
  temporaryPassword: string
}

export class ResetUserPasswordUseCase {
  private readonly authRepository: AuthRepository
  private readonly userRepository: UserRepository

  constructor(authRepository: AuthRepository, userRepository: UserRepository) {
    this.authRepository = authRepository
    this.userRepository = userRepository
  }

  async execute(actor: User, userId: string): Promise<ResetUserPasswordResult> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede restablecer contraseñas',
      )
    }

    const targetId = userId.trim()
    if (!targetId) {
      throw new ValidationError('Usuario inválido')
    }

    if (targetId === actor.id) {
      throw new ValidationError(
        'No puedes restablecer tu propia contraseña desde aquí',
      )
    }

    const target = await this.userRepository.getById(targetId)
    if (!target) {
      throw new ValidationError('Usuario no encontrado')
    }

    const temporaryPassword =
      await this.authRepository.resetTemporaryPassword(targetId)

    const updated = await this.userRepository.getById(targetId)
    if (!updated) {
      throw new ValidationError(
        'Usuario no encontrado tras el restablecimiento',
      )
    }

    return {
      user: updated,
      temporaryPassword,
    }
  }
}
