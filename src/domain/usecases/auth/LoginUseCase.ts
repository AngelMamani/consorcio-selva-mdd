import type { AuthCredentials, AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'

export class LoginUseCase {
  private readonly authRepository: AuthRepository
  private readonly userRepository: UserRepository

  constructor(authRepository: AuthRepository, userRepository: UserRepository) {
    this.authRepository = authRepository
    this.userRepository = userRepository
  }

  async execute(credentials: AuthCredentials): Promise<User> {
    const email = credentials.email.trim().toLowerCase()
    const password = credentials.password

    if (!email || !password) {
      throw new ValidationError('Correo y contraseña son obligatorios')
    }

    const userId = await this.authRepository.login({ email, password })
    const user = await this.userRepository.getById(userId)

    if (!user) {
      await this.authRepository.logout()
      throw new UnauthorizedError('Usuario sin perfil registrado en el sistema')
    }

    if (!user.active) {
      await this.authRepository.logout()
      throw new UnauthorizedError('Tu cuenta está desactivada. Contacta al administrador')
    }

    return user
  }
}
