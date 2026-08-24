import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import { UserRole, isUserRole, canManageOperationalRoles } from '@/domain/value-objects/UserRole'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import { normalizeOptionalDni } from '@/domain/value-objects/Dni'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export interface UpdateUserRequest {
  userId: string
  displayName?: string
  role?: UserRole
  dni?: string
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

    if (
      request.role === UserRole.SuperAdministrador &&
      !canManageOperationalRoles(actor.role)
    ) {
      throw new UnauthorizedError(
        'Solo el Super Administrador puede asignar ese rol',
      )
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
      (existing.role === UserRole.Administrador ||
        existing.role === UserRole.SuperAdministrador) &&
      nextRole !== UserRole.Administrador &&
      nextRole !== UserRole.SuperAdministrador
    ) {
      const all = await this.userRepository.listAll()
      const otherActiveAdmins = all.filter(
        (item) =>
          item.id !== existing.id &&
          (item.role === UserRole.Administrador ||
            item.role === UserRole.SuperAdministrador) &&
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
      nameChanged || roleChanged || request.active !== undefined || request.dni !== undefined

    if (!shouldPatch) {
      return existing
    }

    let nextDni: string | undefined
    if (request.dni !== undefined) {
      nextDni = normalizeOptionalDni(request.dni)
      if (nextDni && nextDni !== existing.dni) {
        const duplicate = await this.userRepository.findByDni(nextDni)
        if (duplicate && duplicate.id !== existing.id) {
          throw new ValidationError('Ya existe un usuario con ese DNI')
        }
      }
    }

    const resolvedRole = nextRole ?? existing.role
    const resolvedDni = nextDni !== undefined ? nextDni : existing.dni
    if (resolvedRole === UserRole.Tecnico && !resolvedDni) {
      throw new ValidationError('El DNI es el código de acceso del técnico')
    }

    return this.userRepository.update(request.userId, {
      ...(nameChanged ? { displayName } : {}),
      ...(request.role !== undefined ? { role: request.role } : {}),
      ...(request.active !== undefined ? { active: request.active } : {}),
      ...(nextDni !== undefined ? { dni: nextDni } : {}),
    })
  }
}
