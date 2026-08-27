import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import type { UserRole } from '@/domain/value-objects/UserRole'
import {
  UserRole as Role,
  isUserRole,
  canManageOperationalRoles,
} from '@/domain/value-objects/UserRole'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import { normalizeOptionalDni } from '@/domain/value-objects/Dni'
import { technicianEmailFromDni } from '@/domain/value-objects/TechnicianLogin'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export interface CreateUserRequest {
  email: string
  displayName: string
  role: UserRole
  dni?: string
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

    const displayName = request.displayName.trim()
    const dni = normalizeOptionalDni(request.dni ?? '')
    let email = request.email.trim().toLowerCase()

    if (request.role === Role.Tecnico && !dni) {
      throw new ValidationError('El DNI es el código de acceso del técnico')
    }

    if (!email && dni) {
      email = technicianEmailFromDni(dni)
    }

    if (!displayName) {
      throw new ValidationError('El nombre es obligatorio')
    }

    if (!email) {
      throw new ValidationError(
        request.role === Role.Tecnico
          ? 'El DNI es el código de acceso del técnico'
          : 'Nombre y correo o DNI son obligatorios',
      )
    }

    if (!isUserRole(request.role)) {
      throw new ValidationError('Rol inválido')
    }

    if (
      request.role === Role.SuperAdministrador &&
      !canManageOperationalRoles(actor.role)
    ) {
      throw new UnauthorizedError(
        'Solo el Super Administrador puede crear otro Super Administrador',
      )
    }

    if (dni) {
      const matches = await this.userRepository.listByDni(dni)
      if (matches.length > 0) {
        throw new ValidationError('Ya existe un usuario con ese DNI')
      }
    }

    const created = await this.authRepository.createManagedUser({
      email,
      displayName,
      role: request.role,
      dni,
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
