export const AttendanceOrigin = {
  Oficina: 'OFICINA',
  Zona: 'ZONA',
} as const

export type AttendanceOrigin =
  (typeof AttendanceOrigin)[keyof typeof AttendanceOrigin]

export function isAttendanceOrigin(value: string): value is AttendanceOrigin {
  return value === AttendanceOrigin.Oficina || value === AttendanceOrigin.Zona
}

export function attendanceOriginLabel(origin: AttendanceOrigin): string {
  return origin === AttendanceOrigin.Oficina ? 'Oficina' : 'Zona de trabajo'
}

export interface Attendance {
  id: string
  userId: string
  userName: string
  dateKey: string
  origin: AttendanceOrigin
  areaId: string
  areaName: string
  latitude: number
  longitude: number
  accuracyMeters?: number
  distanceToOfficeMeters?: number
  officeValidated: boolean
  environmentPhotoUrl?: string
  environmentPhotoPath?: string
  createdAt: Date
}

export function attendanceDocId(userId: string, dateKey: string): string {
  return `${userId}_${dateKey}`
}

/** Fecha operativa en zona horaria de Perú (UTC-5, sin horario de verano). */
export function toLimaDateKey(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

export function formatAttendanceTime(date: Date): string {
  return date.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const OFFICE_QR_PREFIX = 'CSMDD1'

export interface OfficeQrPayload {
  dateKey: string
  token: string
}

export function limaDayUtcBounds(dateKey: string): {
  validFrom: Date
  validUntil: Date
} {
  const validFrom = new Date(`${dateKey}T05:00:00.000Z`)
  const parts = dateKey.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
  return {
    validFrom,
    validUntil: new Date(`${nextKey}T05:00:00.000Z`),
  }
}

export function createOfficeQrToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function buildOfficeQrPayload(dateKey: string, token: string): string {
  return `${OFFICE_QR_PREFIX}|${dateKey}|${token}`
}

export function parseOfficeQrPayload(raw: string): OfficeQrPayload | null {
  const parts = raw.trim().split('|')
  if (parts.length !== 3) return null
  const [prefix, dateKey, token] = parts
  if (prefix !== OFFICE_QR_PREFIX || !dateKey || !token) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  if (!/^[a-f0-9]{48}$/.test(token)) return null
  return { dateKey, token }
}
