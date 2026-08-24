export const UserRole = {
  SuperAdministrador: 'SUPER_ADMINISTRADOR',
  Administrador: 'ADMINISTRADOR',
  Tecnico: 'TECNICO',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export function isUserRole(value: string): value is UserRole {
  return (
    value === UserRole.SuperAdministrador ||
    value === UserRole.Administrador ||
    value === UserRole.Tecnico
  )
}

export function userRoleLabel(role: UserRole): string {
  if (role === UserRole.SuperAdministrador) return 'Super Administrador'
  if (role === UserRole.Administrador) return 'Administrador'
  return 'Técnico'
}

export function canManageOperationalRoles(role: UserRole): boolean {
  return role === UserRole.SuperAdministrador
}

export function canManageUsers(role: UserRole): boolean {
  return (
    role === UserRole.SuperAdministrador || role === UserRole.Administrador
  )
}

export const CONFIGURED_SUPER_ADMIN_EMAIL = 'amamanim@unamad.edu.pe'
