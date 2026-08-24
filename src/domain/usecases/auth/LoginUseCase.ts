import type { AuthCredentials, AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'
import { digitsOnly, DNI_PATTERN } from '@/domain/value-objects/Dni'

export class LoginUseCase {
  private readonly authRepository: AuthRepository
  private readonly userRepository: UserRepository

  constructor(authRepository: AuthRepository, userRepository: UserRepository) {
    this.authRepository = authRepository
    this.userRepository = userRepository
  }

  async execute(credentials: AuthCredentials): Promise<User> {
    const identifier = credentials.identifier.trim()
    const password = credentials.password

    if (!identifier || !password) {
      throw new ValidationError('Correo o código (DNI) y contraseña son obligatorios')
    }

    const email = identifier.includes('@')
      ? identifier.toLowerCase()
      : await this.resolveDniEmail(identifier)

    const userId = await this.authRepository.login(email, password)
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

  private async resolveDniEmail(identifier: string): Promise<string> {
    const dni = digitsOnly(identifier)
    if (!DNI_PATTERN.test(dni)) {
      throw new ValidationError(
        'Ingresa tu correo electrónico o tu código (DNI de 8 dígitos)',
      )
    }
    return this.authRepository.resolveEmailByDni(dni)
  }
}
