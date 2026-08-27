export const UserRole = {
  SuperAdministrador: 'SUPER_ADMINISTRADOR',
  Administrador: 'ADMINISTRADOR',
  Tecnico: 'TECNICO',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const ALL_USER_ROLES: UserRole[] = [
  UserRole.SuperAdministrador,
  UserRole.Administrador,
  UserRole.Tecnico,
]

export const WEB_USER_ROLES: UserRole[] = [
  UserRole.SuperAdministrador,
  UserRole.Administrador,
]

export const MOBILE_USER_ROLES: UserRole[] = [
  UserRole.Administrador,
  UserRole.Tecnico,
]

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

export function userRoleAccessHint(role: UserRole): string {
  if (role === UserRole.SuperAdministrador) return 'Solo página web'
  if (role === UserRole.Administrador) return 'Página web y aplicativo móvil'
  return 'Solo aplicativo móvil'
}

export function canManageOperationalRoles(role: UserRole): boolean {
  return role === UserRole.SuperAdministrador
}

export function canManageUsers(role: UserRole): boolean {
  return (
    role === UserRole.SuperAdministrador || role === UserRole.Administrador
  )
}

export function normalizeUserRoles(values: readonly string[]): UserRole[] {
  const unique = new Set<UserRole>()
  for (const value of values) {
    if (isUserRole(value)) unique.add(value)
  }
  return ALL_USER_ROLES.filter((role) => unique.has(role)).slice(0, 3)
}

export function primaryUserRole(roles: readonly UserRole[]): UserRole | null {
  if (roles.includes(UserRole.SuperAdministrador)) {
    return UserRole.SuperAdministrador
  }
  if (roles.includes(UserRole.Administrador)) {
    return UserRole.Administrador
  }
  if (roles.includes(UserRole.Tecnico)) return UserRole.Tecnico
  return null
}

export function assignedUserRoles(user: {
  role: UserRole
  roles?: readonly UserRole[]
}): UserRole[] {
  const fromList = normalizeUserRoles(user.roles ?? [])
  if (fromList.length > 0) return fromList
  return isUserRole(user.role) ? [user.role] : []
}

export function hasAssignedRole(
  user: { role: UserRole; roles?: readonly UserRole[] },
  role: UserRole,
): boolean {
  return assignedUserRoles(user).includes(role)
}

export function webAccessRoles(user: {
  role: UserRole
  roles?: readonly UserRole[]
}): UserRole[] {
  return assignedUserRoles(user).filter((role) =>
    WEB_USER_ROLES.includes(role),
  )
}

export function mobileAccessRoles(user: {
  role: UserRole
  roles?: readonly UserRole[]
}): UserRole[] {
  return assignedUserRoles(user).filter((role) =>
    MOBILE_USER_ROLES.includes(role),
  )
}

export const CONFIGURED_SUPER_ADMIN_EMAIL = 'amamanim@unamad.edu.pe'
export const ACTIVE_ROLE_STORAGE_KEY = 'consorcio-active-role'
