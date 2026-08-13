/** Clave temporal fija para altas y restablecimientos. */
export const DEFAULT_TEMPORARY_PASSWORD = '87654321'

/** Claves temporales antiguas que tampoco se aceptan como definitivas. */
const LEGACY_TEMPORARY_PASSWORDS = new Set(['12345678', '87654321'])

const MIN_PASSWORD_LENGTH = 10

export function isSecurePassword(password: string): boolean {
  if (password.length < MIN_PASSWORD_LENGTH) return false
  if (LEGACY_TEMPORARY_PASSWORDS.has(password)) return false

  const hasUpper = /[A-ZÁÉÍÓÚÑ]/.test(password)
  const hasLower = /[a-záéíóúñ]/.test(password)
  const hasNumber = /\d/.test(password)
  return hasUpper && hasLower && hasNumber
}

export function securePasswordRequirementsMessage(): string {
  return `Mínimo ${MIN_PASSWORD_LENGTH} caracteres, con mayúscula, minúscula y número. No uses la temporal ${DEFAULT_TEMPORARY_PASSWORD}.`
}
