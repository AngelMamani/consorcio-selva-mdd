import type { UserRole } from '@/domain/value-objects/UserRole'
import type { ThemePreference } from '@/domain/value-objects/ThemePreference'
import type { ImageFolder } from '@/domain/entities/ImageFolder'

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
  folder: Pick<
    ImageFolder,
    | 'ownerId'
    | 'assignToAllTechnicians'
    | 'assignedTechnicianIds'
  >,
): boolean {
  if (!user.active) return false
  if (user.role === 'ADMINISTRADOR') return true
  if (folder.ownerId === user.id) return true
  if (folder.assignToAllTechnicians) return true
  return (folder.assignedTechnicianIds ?? []).includes(user.id)
}

export function assertUserCanDeleteContent(user: User): boolean {
  return user.role === 'ADMINISTRADOR' && user.active
}

export function assertUserCanEditFolder(
  user: User,
  folder: Pick<
    ImageFolder,
    | 'ownerId'
    | 'assignToAllTechnicians'
    | 'assignedTechnicianIds'
  >,
): boolean {
  return assertUserCanAccessFolder(user, folder)
}

export function formatFolderAssignees(
  folder: Pick<
    ImageFolder,
    'assignToAllTechnicians' | 'assignedTechnicianNames' | 'ownerName'
  >,
): string {
  if (folder.assignToAllTechnicians) return 'Todos los técnicos'
  const names = folder.assignedTechnicianNames ?? []
  if (names.length === 0) return folder.ownerName || 'Sin asignar'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]}, ${names[1]}`
  return `${names[0]} +${names.length - 1}`
}
