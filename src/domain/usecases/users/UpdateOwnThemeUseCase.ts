import type { User } from '@/domain/entities/User'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { ThemePreference } from '@/domain/value-objects/ThemePreference'
import { isThemePreference } from '@/domain/value-objects/ThemePreference'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export class UpdateOwnThemeUseCase {
  private readonly userRepository: UserRepository

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository
  }

  async execute(actor: User, theme: ThemePreference): Promise<User> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    if (!isThemePreference(theme)) {
      throw new ValidationError('Tema inválido')
    }

    return this.userRepository.update(actor.id, { theme })
  }
}
