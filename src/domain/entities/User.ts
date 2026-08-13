import type { UserRole } from '@/domain/value-objects/UserRole'
import type { ThemePreference } from '@/domain/value-objects/ThemePreference'

export interface User {
  id: string
  email: string
  displayName: string
  role: UserRole
  theme: ThemePreference
  mustChangePassword: boolean
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export function assertUserCanManageUsers(user: User): boolean {
  return user.role === 'ADMINISTRADOR' && user.active
}

export function assertUserCanAccessFolder(
  user: User,
  folderOwnerId: string,
): boolean {
  if (!user.active) return false
  if (user.role === 'ADMINISTRADOR') return true
  return user.id === folderOwnerId
}

export function assertUserCanDeleteContent(user: User): boolean {
  return user.role === 'ADMINISTRADOR' && user.active
}

export function assertUserCanEditFolder(
  user: User,
  folderOwnerId: string,
): boolean {
  return assertUserCanAccessFolder(user, folderOwnerId)
}
