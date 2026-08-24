/** Clave temporal fija para altas y restablecimientos. */
export const DEFAULT_TEMPORARY_PASSWORD = '87654321'

/** Claves temporales antiguas que tampoco se aceptan como definitivas. */
const LEGACY_TEMPORARY_PASSWORDS = new Set(['12345678', '87654321'])

/** Mínimo de Firebase Auth. El técnico puede elegir una clave sencilla. */
const MIN_PASSWORD_LENGTH = 6

export function isSecurePassword(password: string): boolean {
  if (password.length < MIN_PASSWORD_LENGTH) return false
  if (LEGACY_TEMPORARY_PASSWORDS.has(password)) return false
  return true
}

export function securePasswordRequirementsMessage(): string {
  return `Mínimo ${MIN_PASSWORD_LENGTH} caracteres. Puede ser sencilla. No uses la temporal ${DEFAULT_TEMPORARY_PASSWORD}.`
}
