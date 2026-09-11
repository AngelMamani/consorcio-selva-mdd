export const AttendanceOrigin = {
  Oficina: 'OFICINA',
  Zona: 'ZONA',
  Permiso: 'PERMISO',
} as const

export type AttendanceOrigin =
  (typeof AttendanceOrigin)[keyof typeof AttendanceOrigin]

export function isAttendanceOrigin(value: string): value is AttendanceOrigin {
  return (
    value === AttendanceOrigin.Oficina ||
    value === AttendanceOrigin.Zona ||
    value === AttendanceOrigin.Permiso
  )
}

export function attendanceOriginLabel(origin: AttendanceOrigin): string {
  if (origin === AttendanceOrigin.Oficina) return 'Oficina'
  if (origin === AttendanceOrigin.Permiso) return 'Permiso'
  return 'Campo'
}

export function attendanceHasGpsPin(attendance: Attendance): boolean {
  if (attendance.origin === AttendanceOrigin.Permiso) return false
  return attendance.latitude !== 0 || attendance.longitude !== 0
}

export function attendanceAttendedLabel(
  attendance: Attendance | null,
): 'Sí' | 'No' {
  if (!attendance) return 'No'
  if (attendance.origin === AttendanceOrigin.Permiso) return 'No'
  return 'Sí'
}

export function attendanceStatusLabel(attendance: Attendance | null): string {
  if (!attendance) return 'No asistió'
  if (attendance.origin === AttendanceOrigin.Permiso) return 'Permiso'
  return 'Asistió'
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
  permissionNote?: string
  markedById?: string
  markedByName?: string
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

/** Genera `count` dateKeys consecutivos desde `startDateKey` (incluido). */
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function addLimaDateKeys(startDateKey: string, count: number): string[] {
  const parts = startDateKey.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const keys: string[] = []
  for (let i = 0; i < count; i += 1) {
    const next = new Date(Date.UTC(year, month - 1, day + i))
    keys.push(
      `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`,
    )
  }
  return keys
}

/** Semana lunes–domingo que contiene `dateKey`. */
export function limaWeekRange(dateKey: string): {
  startDateKey: string
  endDateKey: string
  dateKeys: string[]
} {
  const parts = dateKey.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday
  const monday = new Date(Date.UTC(year, month - 1, day + offsetToMonday))
  const startDateKey = `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`
  const dateKeys = addLimaDateKeys(startDateKey, 7)
  return {
    startDateKey,
    endDateKey: dateKeys[6] ?? startDateKey,
    dateKeys,
  }
}

/** Mes calendario de `dateKey`. */
export function limaMonthRange(dateKey: string): {
  startDateKey: string
  endDateKey: string
  dateKeys: string[]
} {
  const parts = dateKey.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const startDateKey = `${year}-${pad2(month)}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dateKeys = addLimaDateKeys(startDateKey, lastDay)
  return {
    startDateKey,
    endDateKey: dateKeys[dateKeys.length - 1] ?? startDateKey,
    dateKeys,
  }
}

export function clipDateKeysToToday(
  dateKeys: string[],
  todayKey = toLimaDateKey(),
): string[] {
  return dateKeys.filter((key) => key <= todayKey)
}

export function formatAttendanceDayLabel(dateKey: string): string {
  const parts = dateKey.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return date.toLocaleDateString('es-PE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
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
