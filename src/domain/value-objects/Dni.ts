import { ValidationError } from '@/domain/errors/DomainError'

export const DNI_PATTERN = /^\d{8}$/

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizeOptionalDni(value: string): string {
  const dni = digitsOnly(value)
  if (!dni) return ''
  if (!DNI_PATTERN.test(dni)) {
    throw new ValidationError('El DNI debe tener 8 dígitos')
  }
  return dni
}
