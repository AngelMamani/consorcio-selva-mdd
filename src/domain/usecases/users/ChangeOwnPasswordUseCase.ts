import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import {
  DEFAULT_TEMPORARY_PASSWORD,
  isSecurePassword,
  securePasswordRequirementsMessage,
} from '@/domain/value-objects/PasswordPolicy'

export class ChangeOwnPasswordUseCase {
  private readonly authRepository: AuthRepository
  private readonly userRepository: UserRepository

  constructor(authRepository: AuthRepository, userRepository: UserRepository) {
    this.authRepository = authRepository
    this.userRepository = userRepository
  }

  async execute(
    actor: User,
    newPassword: string,
    confirmPassword: string,
  ): Promise<User> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    if (!actor.mustChangePassword) {
      throw new ValidationError('Tu contraseña ya fue actualizada')
    }

    if (!newPassword || !confirmPassword) {
      throw new ValidationError('Completa ambos campos de contraseña')
    }

    if (newPassword !== confirmPassword) {
      throw new ValidationError('Las contraseñas no coinciden')
    }

    if (!isSecurePassword(newPassword)) {
      throw new ValidationError(securePasswordRequirementsMessage())
    }

    if (newPassword === DEFAULT_TEMPORARY_PASSWORD) {
      throw new ValidationError('Debes elegir una contraseña distinta a la temporal')
    }

    await this.authRepository.updatePassword(newPassword)

    return this.userRepository.update(actor.id, {
      mustChangePassword: false,
    })
  }
}
