import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import type { UserRole } from '@/domain/value-objects/UserRole'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { isUserRole } from '@/domain/value-objects/UserRole'

export interface CreateUserRequest {
  email: string
  displayName: string
  role: UserRole
}

export interface CreateUserResult {
  user: User
  temporaryPassword: string
}

export class CreateUserUseCase {
  private readonly authRepository: AuthRepository
  private readonly userRepository: UserRepository

  constructor(authRepository: AuthRepository, userRepository: UserRepository) {
    this.authRepository = authRepository
    this.userRepository = userRepository
  }

  async execute(actor: User, request: CreateUserRequest): Promise<CreateUserResult> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede crear usuarios')
    }

    const email = request.email.trim().toLowerCase()
    const displayName = request.displayName.trim()

    if (!email || !displayName) {
      throw new ValidationError('Nombre y correo son obligatorios')
    }

    if (!isUserRole(request.role)) {
      throw new ValidationError('Rol inválido')
    }

    const created = await this.authRepository.createManagedUser({
      email,
      displayName,
      role: request.role,
    })

    const user = await this.userRepository.getById(created.userId)
    if (!user) {
      throw new ValidationError(
        'Usuario creado en Auth, pero el perfil aún no está disponible',
      )
    }

    return {
      user,
      temporaryPassword: created.temporaryPassword,
    }
  }
}
