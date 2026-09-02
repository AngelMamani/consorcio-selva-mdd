import { distanceMeters } from '@/domain/services/GeoDistanceService'
import { isValidGeoLocation } from '@/domain/value-objects/GeoLocation'

export const DEFAULT_OFFICE_LATITUDE = -12.59331
export const DEFAULT_OFFICE_LONGITUDE = -69.18915
export const DEFAULT_OFFICE_RADIUS_METERS = 30
export const MIN_OFFICE_RADIUS_METERS = 10
export const MAX_OFFICE_RADIUS_METERS = 80
export const DEFAULT_OFFICE_NAME = 'Oficina Consorcio Selva MDD'
export const MAX_OFFICE_POINTS = 12

export interface AttendanceOfficePoint {
  id: string
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
}

export interface AttendanceSettings {
  officePoints: AttendanceOfficePoint[]
  /** Campos legacy (primer punto) para compatibilidad con apps antiguas. */
  officeName: string
  officeLatitude: number
  officeLongitude: number
  officeRadiusMeters: number
  updatedAt: Date
  updatedById: string
  updatedByName: string
}

export function createOfficePointId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `office_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function defaultOfficePoint(
  overrides: Partial<AttendanceOfficePoint> = {},
): AttendanceOfficePoint {
  return {
    id: createOfficePointId(),
    name: DEFAULT_OFFICE_NAME,
    latitude: DEFAULT_OFFICE_LATITUDE,
    longitude: DEFAULT_OFFICE_LONGITUDE,
    radiusMeters: DEFAULT_OFFICE_RADIUS_METERS,
    ...overrides,
  }
}

export function defaultAttendanceSettings(): AttendanceSettings {
  const primary = defaultOfficePoint()
  return syncLegacyFields({
    officePoints: [primary],
    officeName: primary.name,
    officeLatitude: primary.latitude,
    officeLongitude: primary.longitude,
    officeRadiusMeters: primary.radiusMeters,
    updatedAt: new Date(0),
    updatedById: '',
    updatedByName: '',
  })
}

/** Radios antiguos (p. ej. 180 m) se tratan como zona chica de check-in. */
export function normalizeOfficeRadiusMeters(meters: number): number {
  const value = Math.round(meters)
  if (
    Number.isNaN(value) ||
    value < MIN_OFFICE_RADIUS_METERS ||
    value > MAX_OFFICE_RADIUS_METERS
  ) {
    return DEFAULT_OFFICE_RADIUS_METERS
  }
  return value
}

function syncLegacyFields(settings: AttendanceSettings): AttendanceSettings {
  const primary = settings.officePoints[0]
  if (!primary) return settings
  return {
    ...settings,
    officeName: primary.name,
    officeLatitude: primary.latitude,
    officeLongitude: primary.longitude,
    officeRadiusMeters: primary.radiusMeters,
  }
}

export function normalizeOfficePoint(
  input: Partial<AttendanceOfficePoint> & { name: string },
): AttendanceOfficePoint {
  const name = input.name.trim()
  if (!name) {
    throw new Error('El nombre del punto es obligatorio')
  }
  const latitude = Number(input.latitude)
  const longitude = Number(input.longitude)
  if (!isValidGeoLocation(latitude, longitude)) {
    throw new Error('La ubicación del punto no es válida')
  }
  return {
    id: (input.id ?? createOfficePointId()).trim() || createOfficePointId(),
    name: name.slice(0, 120),
    latitude,
    longitude,
    radiusMeters: normalizeOfficeRadiusMeters(
      Number(input.radiusMeters ?? DEFAULT_OFFICE_RADIUS_METERS),
    ),
  }
}

export function normalizeAttendanceSettings(
  raw: Partial<AttendanceSettings> & {
    officePoints?: Array<Partial<AttendanceOfficePoint> & { name: string }>
  },
): AttendanceSettings {
  const points = Array.isArray(raw.officePoints)
    ? raw.officePoints.map((point) => normalizeOfficePoint(point))
    : []

  const legacyPoint =
    points.length === 0 &&
    typeof raw.officeName === 'string' &&
    isValidGeoLocation(
      Number(raw.officeLatitude),
      Number(raw.officeLongitude),
    )
      ? normalizeOfficePoint({
          id: createOfficePointId(),
          name: raw.officeName,
          latitude: Number(raw.officeLatitude),
          longitude: Number(raw.officeLongitude),
          radiusMeters: Number(
            raw.officeRadiusMeters ?? DEFAULT_OFFICE_RADIUS_METERS,
          ),
        })
      : null

  const officePoints =
    points.length > 0 ? points : legacyPoint ? [legacyPoint] : [defaultOfficePoint()]

  return syncLegacyFields({
    officePoints,
    officeName: officePoints[0]?.name ?? DEFAULT_OFFICE_NAME,
    officeLatitude: officePoints[0]?.latitude ?? DEFAULT_OFFICE_LATITUDE,
    officeLongitude: officePoints[0]?.longitude ?? DEFAULT_OFFICE_LONGITUDE,
    officeRadiusMeters:
      officePoints[0]?.radiusMeters ?? DEFAULT_OFFICE_RADIUS_METERS,
    updatedAt: raw.updatedAt ?? new Date(0),
    updatedById: raw.updatedById ?? '',
    updatedByName: raw.updatedByName ?? '',
  })
}

export function resolveOfficePoints(
  settings: AttendanceSettings,
): AttendanceOfficePoint[] {
  if (settings.officePoints.length > 0) return settings.officePoints
  return [
    {
      id: 'legacy',
      name: settings.officeName,
      latitude: settings.officeLatitude,
      longitude: settings.officeLongitude,
      radiusMeters: normalizeOfficeRadiusMeters(settings.officeRadiusMeters),
    },
  ]
}

export interface OfficeMatchResult {
  point: AttendanceOfficePoint
  distanceMeters: number
}

/** Devuelve el punto de oficina más cercano dentro de su radio. */
export function findMatchingOfficePoint(
  latitude: number,
  longitude: number,
  settings: AttendanceSettings,
): OfficeMatchResult | null {
  let best: OfficeMatchResult | null = null
  for (const point of resolveOfficePoints(settings)) {
    const distance = Math.round(
      distanceMeters(latitude, longitude, point.latitude, point.longitude),
    )
    if (distance > point.radiusMeters) continue
    if (!best || distance < best.distanceMeters) {
      best = { point, distanceMeters: distance }
    }
  }
  return best
}

export function officePointsSummary(settings: AttendanceSettings): string {
  return resolveOfficePoints(settings)
    .map((point) => `${point.name} (${point.radiusMeters} m)`)
    .join(' · ')
}
