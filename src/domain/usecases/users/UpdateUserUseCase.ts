import type { AuthRepository } from '@/domain/repositories/AuthRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { User } from '@/domain/entities/User'
import { UserRole, isUserRole, canManageOperationalRoles, hasAssignedRole } from '@/domain/value-objects/UserRole'
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
  roles?: UserRole[]
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
      (request.role === UserRole.SuperAdministrador ||
        request.roles?.includes(UserRole.SuperAdministrador)) &&
      !canManageOperationalRoles(actor.role)
    ) {
      throw new UnauthorizedError(
        'Solo el Super Administrador puede asignar ese rol',
      )
    }

    if (actor.id === request.userId && request.active === false) {
      throw new ValidationError('No puedes desactivar tu propia cuenta')
    }

    const existingIsPrivileged =
      hasAssignedRole(existing, UserRole.Administrador) ||
      hasAssignedRole(existing, UserRole.SuperAdministrador)

    if (
      request.active === false &&
      hasAssignedRole(existing, UserRole.SuperAdministrador) &&
      !canManageOperationalRoles(actor.role)
    ) {
      throw new UnauthorizedError(
        'Solo el Super Administrador puede desactivar a otro Super Administrador',
      )
    }

    const nextRole = request.role
    const roleChanged =
      nextRole !== undefined && nextRole !== existing.role

    if (roleChanged && actor.id === request.userId) {
      throw new ValidationError('No puedes cambiar tu propio rol')
    }

    if (
      (request.active === false && existingIsPrivileged) ||
      (roleChanged &&
        existingIsPrivileged &&
        nextRole !== UserRole.Administrador &&
        nextRole !== UserRole.SuperAdministrador)
    ) {
      const all = await this.userRepository.listAll()
      const otherActiveAdmins = all.filter(
        (item) =>
          item.id !== existing.id &&
          item.active &&
          (hasAssignedRole(item, UserRole.Administrador) ||
            hasAssignedRole(item, UserRole.SuperAdministrador)),
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

    const rolesChanged = request.roles !== undefined
    const shouldPatch =
      nameChanged ||
      roleChanged ||
      rolesChanged ||
      request.active !== undefined ||
      request.dni !== undefined

    if (!shouldPatch) {
      return existing
    }

    let nextDni: string | undefined
    if (request.dni !== undefined) {
      nextDni = normalizeOptionalDni(request.dni)
      if (nextDni && nextDni !== existing.dni) {
        const matches = await this.userRepository.listByDni(nextDni)
        if (matches.some((item) => item.id !== existing.id)) {
          throw new ValidationError('Ya existe un usuario con ese DNI')
        }
      }
    }

    const resolvedRole = nextRole ?? existing.role
    const resolvedDni = nextDni !== undefined ? nextDni : existing.dni
    const nextRoles = request.roles ?? existing.roles
    if (
      (request.role !== undefined ||
        request.roles !== undefined ||
        request.dni !== undefined) &&
      (resolvedRole === UserRole.Tecnico ||
        nextRoles.includes(UserRole.Tecnico) ||
        nextRoles.includes(UserRole.Administrador)) &&
      !resolvedDni
    ) {
      throw new ValidationError('El DNI es el código de acceso a la app')
    }

    if (request.active !== undefined && request.active !== existing.active) {
      await this.authRepository.setManagedUserActive(
        request.userId,
        request.active,
      )
    }

    return this.userRepository.update(request.userId, {
      ...(nameChanged ? { displayName } : {}),
      ...(request.role !== undefined ? { role: request.role } : {}),
      ...(request.roles !== undefined ? { roles: request.roles } : {}),
      ...(request.active !== undefined ? { active: request.active } : {}),
      ...(nextDni !== undefined ? { dni: nextDni } : {}),
    })
  }
}
