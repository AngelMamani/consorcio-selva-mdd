import type { AppMenuKey } from '@/domain/value-objects/AppMenuPermission'
import { AppMenuKey as MenuKey, ALL_APP_MENU_KEYS } from '@/domain/value-objects/AppMenuPermission'
import { UserRole } from '@/domain/value-objects/UserRole'

export interface OperationalRole {
  id: string
  name: string
  code: string
  permissions: AppMenuKey[]
  isSystem: boolean
  createdById: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

export interface OperationalRoleInput {
  name: string
  code: string
  permissions: AppMenuKey[]
}

export const DEFAULT_OPERATIONAL_ROLES: Array<{
  name: string
  code: string
  permissions: AppMenuKey[]
}> = [
  {
    name: 'Super Administrador',
    code: UserRole.SuperAdministrador,
    permissions: [...ALL_APP_MENU_KEYS],
  },
  {
    name: 'Administrador',
    code: UserRole.Administrador,
    permissions: ALL_APP_MENU_KEYS.filter((key) => key !== MenuKey.Roles),
  },
  {
    name: 'Técnico',
    code: UserRole.Tecnico,
    permissions: [
      MenuKey.Inicio,
      MenuKey.Estaciones,
      MenuKey.Areas,
      MenuKey.Tareas,
      MenuKey.Asistencias,
      MenuKey.Mapa,
    ],
  },
]
