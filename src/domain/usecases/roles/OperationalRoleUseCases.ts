import type { User } from '@/domain/entities/User'
import {
  DEFAULT_OPERATIONAL_ROLES,
  type OperationalRole,
  type OperationalRoleInput,
} from '@/domain/entities/OperationalRole'
import type { OperationalRoleRepository } from '@/domain/repositories/OperationalRoleRepository'
import type { AppMenuKey } from '@/domain/value-objects/AppMenuPermission'
import { ALL_APP_MENU_KEYS, isAppMenuKey } from '@/domain/value-objects/AppMenuPermission'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { canManageOperationalRoles } from '@/domain/value-objects/UserRole'

function normalizeName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) throw new ValidationError('El nombre del rol es obligatorio')
  if (trimmed.length > 80) {
    throw new ValidationError('El nombre no debe superar 80 caracteres')
  }
  return trimmed
}

function normalizeCode(code: string): string {
  const trimmed = code
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
  if (!trimmed) throw new ValidationError('El código del rol es obligatorio')
  if (trimmed.length > 40) {
    throw new ValidationError('El código no debe superar 40 caracteres')
  }
  return trimmed
}

function normalizePermissions(permissions: AppMenuKey[]): AppMenuKey[] {
  const unique = [...new Set(permissions.filter(isAppMenuKey))]
  if (unique.length === 0) {
    throw new ValidationError('Selecciona al menos un menú o actividad')
  }
  return unique
}

function assertCanManageRoles(actor: User): void {
  if (!actor.active || !canManageOperationalRoles(actor.role)) {
    throw new UnauthorizedError('Solo el Super Administrador puede gestionar roles')
  }
}

export class ListOperationalRolesUseCase {
  private readonly roleRepository: OperationalRoleRepository

  constructor(roleRepository: OperationalRoleRepository) {
    this.roleRepository = roleRepository
  }

  async execute(actor: User): Promise<OperationalRole[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    return this.roleRepository.listAll()
  }
}

export class GetOperationalRolePermissionsUseCase {
  private readonly roleRepository: OperationalRoleRepository

  constructor(roleRepository: OperationalRoleRepository) {
    this.roleRepository = roleRepository
  }

  async execute(actor: User): Promise<AppMenuKey[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    try {
      const role = await this.roleRepository.getByCode(actor.role)
      if (role) return role.permissions
    } catch {
      // Colección aún no disponible o reglas pendientes.
    }
    const fallback = DEFAULT_OPERATIONAL_ROLES.find((item) => item.code === actor.role)
    return fallback ? [...fallback.permissions] : [...ALL_APP_MENU_KEYS]
  }
}

export class EnsureDefaultOperationalRolesUseCase {
  private readonly roleRepository: OperationalRoleRepository

  constructor(roleRepository: OperationalRoleRepository) {
    this.roleRepository = roleRepository
  }

  async execute(actor: User): Promise<OperationalRole[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    const existing = await this.roleRepository.listAll()

    if (existing.length === 0) {
      if (!canManageOperationalRoles(actor.role)) {
        return existing
      }
      for (const item of DEFAULT_OPERATIONAL_ROLES) {
        await this.roleRepository.create({
          name: item.name,
          code: item.code,
          permissions: item.permissions,
          isSystem: true,
          createdById: actor.id,
          createdByName: actor.displayName,
        })
      }
      return this.roleRepository.listAll()
    }

    if (canManageOperationalRoles(actor.role)) {
      for (const role of existing) {
        if (!role.isSystem) continue
        const defaults = DEFAULT_OPERATIONAL_ROLES.find(
          (item) => item.code === role.code,
        )
        if (!defaults) continue
        const missing = defaults.permissions.filter(
          (key) => !role.permissions.includes(key),
        )
        if (missing.length === 0) continue
        await this.roleRepository.update(role.id, {
          name: role.name,
          permissions: [...role.permissions, ...missing],
        })
      }
      return this.roleRepository.listAll()
    }

    return existing
  }
}

export class CreateOperationalRoleUseCase {
  private readonly roleRepository: OperationalRoleRepository

  constructor(roleRepository: OperationalRoleRepository) {
    this.roleRepository = roleRepository
  }

  async execute(actor: User, input: OperationalRoleInput): Promise<OperationalRole> {
    assertCanManageRoles(actor)
    const name = normalizeName(input.name)
    const code = normalizeCode(input.code)
    const permissions = normalizePermissions(input.permissions)
    const duplicate = await this.roleRepository.getByCode(code)
    if (duplicate) {
      throw new ValidationError('Ya existe un rol con ese código')
    }
    return this.roleRepository.create({
      name,
      code,
      permissions,
      isSystem: false,
      createdById: actor.id,
      createdByName: actor.displayName,
    })
  }
}

export class UpdateOperationalRoleUseCase {
  private readonly roleRepository: OperationalRoleRepository

  constructor(roleRepository: OperationalRoleRepository) {
    this.roleRepository = roleRepository
  }

  async execute(
    actor: User,
    id: string,
    input: { name: string; permissions: AppMenuKey[] },
  ): Promise<OperationalRole> {
    assertCanManageRoles(actor)
    const current = await this.roleRepository.getById(id)
    if (!current) {
      throw new ValidationError('Rol no encontrado')
    }
    return this.roleRepository.update(id, {
      name: normalizeName(input.name),
      permissions: normalizePermissions(input.permissions),
    })
  }
}

export class DeleteOperationalRoleUseCase {
  private readonly roleRepository: OperationalRoleRepository

  constructor(roleRepository: OperationalRoleRepository) {
    this.roleRepository = roleRepository
  }

  async execute(actor: User, id: string): Promise<void> {
    assertCanManageRoles(actor)
    const current = await this.roleRepository.getById(id)
    if (!current) {
      throw new ValidationError('Rol no encontrado')
    }
    if (current.isSystem) {
      throw new ValidationError('Los roles del sistema no se pueden eliminar')
    }
    const usersCount = await this.roleRepository.countUsersByRoleCode(current.code)
    if (usersCount > 0) {
      throw new ValidationError(
        `No se puede eliminar: hay ${usersCount} usuario${usersCount === 1 ? '' : 's'} con este rol`,
      )
    }
    await this.roleRepository.delete(id)
  }
}
