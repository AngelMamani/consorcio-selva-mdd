export const UserRole = {
  Administrador: 'ADMINISTRADOR',
  Tecnico: 'TECNICO',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export function isUserRole(value: string): value is UserRole {
  return value === UserRole.Administrador || value === UserRole.Tecnico
}

export function userRoleLabel(role: UserRole): string {
  return role === UserRole.Administrador ? 'Administrador' : 'Técnico'
}
