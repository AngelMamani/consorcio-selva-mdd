import type { UserRole } from '@/domain/value-objects/UserRole'
import { canManageUsers } from '@/domain/value-objects/UserRole'
import type { ThemePreference } from '@/domain/value-objects/ThemePreference'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import { DNI_PATTERN, digitsOnly } from '@/domain/value-objects/Dni'
import { isTechnicianSyntheticEmail } from '@/domain/value-objects/TechnicianLogin'

export interface User {
  id: string
  email: string
  displayName: string
  dni: string
  role: UserRole
  roles: UserRole[]
  theme: ThemePreference
  mustChangePassword: boolean
  active: boolean
  createdAt: Date
  updatedAt: Date
}

/** DNI de acceso: campo `dni` o el prefijo del correo sintético del técnico. */
export function userAccessDni(user: Pick<User, 'dni' | 'email'>): string {
  const dni = digitsOnly(user.dni ?? '')
  if (DNI_PATTERN.test(dni)) return dni
  const email = user.email.trim().toLowerCase()
  if (isTechnicianSyntheticEmail(email)) {
    const prefix = email.split('@')[0] ?? ''
    if (DNI_PATTERN.test(prefix)) return prefix
  }
  return ''
}

export function pickCanonicalUser(users: readonly User[]): User | null {
  if (users.length === 0) return null
  const ranked = [...users].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1
    const leftRoles = left.roles?.length ?? 0
    const rightRoles = right.roles?.length ?? 0
    if (leftRoles !== rightRoles) return rightRoles - leftRoles
    return right.updatedAt.getTime() - left.updatedAt.getTime()
  })
  return ranked[0] ?? null
}

export function groupUsersByAccessDni(users: readonly User[]): Map<string, User[]> {
  const groups = new Map<string, User[]>()
  for (const user of users) {
    const dni = userAccessDni(user)
    if (!dni) continue
    const group = groups.get(dni) ?? []
    group.push(user)
    groups.set(dni, group)
  }
  return groups
}

/** Una cuenta por DNI; las cuentas sin DNI (p. ej. super admin inicial) se conservan. */
export function uniqueUsersByAccessDni(users: readonly User[]): User[] {
  const seen = new Set<string>()
  const unique: User[] = []
  for (const group of groupUsersByAccessDni(users).values()) {
    const canonical = pickCanonicalUser(group)
    if (!canonical) continue
    unique.push(canonical)
    seen.add(canonical.id)
  }
  for (const user of users) {
    if (seen.has(user.id)) continue
    if (userAccessDni(user)) continue
    unique.push(user)
  }
  return unique
}

export function assertUserCanManageUsers(user: User): boolean {
  return canManageUsers(user.role) && user.active
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
  if (user.role === 'SUPER_ADMINISTRADOR' || user.role === 'ADMINISTRADOR') {
    return true
  }
  if (folder.ownerId === user.id) return true
  if (folder.assignToAllTechnicians) return true
  return (folder.assignedTechnicianIds ?? []).includes(user.id)
}

export function assertUserCanDeleteContent(user: User): boolean {
  return (
    (user.role === 'SUPER_ADMINISTRADOR' || user.role === 'ADMINISTRADOR') &&
    user.active
  )
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
