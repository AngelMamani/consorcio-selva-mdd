import type { User } from '@/domain/entities/User'
import {
  ACTIVE_ROLE_STORAGE_KEY,
  isUserRole,
  primaryUserRole,
  webAccessRoles,
  type UserRole,
} from '@/domain/value-objects/UserRole'

export function readStoredActiveRole(): UserRole | null {
  try {
    const value = sessionStorage.getItem(ACTIVE_ROLE_STORAGE_KEY)
    return value && isUserRole(value) ? value : null
  } catch {
    return null
  }
}

export function writeStoredActiveRole(role: UserRole): void {
  try {
    sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role)
  } catch {
    // Navegadores en modo restringido: el rol queda solo en memoria.
  }
}

export function clearStoredActiveRole(): void {
  try {
    sessionStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY)
  } catch {
    // Sin almacenamiento de sesión.
  }
}

/** Aplica el rol web guardado. Si hay dos roles y no hay elección, devuelve null. */
export function overlayWebActiveRole(
  user: User,
  options: { pickDefault?: boolean } = {},
): User | null {
  const web = webAccessRoles(user)
  if (web.length === 0) return null
  const stored = readStoredActiveRole()
  if (stored && web.includes(stored)) {
    return { ...user, role: stored }
  }
  if (web.length === 1 || options.pickDefault) {
    const active = primaryUserRole(web) ?? web[0]
    writeStoredActiveRole(active)
    return { ...user, role: active }
  }
  return null
}
