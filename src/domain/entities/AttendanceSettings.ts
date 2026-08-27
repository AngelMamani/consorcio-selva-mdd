export const DEFAULT_OFFICE_LATITUDE = -12.59331
export const DEFAULT_OFFICE_LONGITUDE = -69.18915
export const DEFAULT_OFFICE_RADIUS_METERS = 30
export const MIN_OFFICE_RADIUS_METERS = 10
export const MAX_OFFICE_RADIUS_METERS = 80
export const DEFAULT_OFFICE_NAME = 'Oficina Consorcio Selva MDD'

export interface AttendanceSettings {
  officeName: string
  officeLatitude: number
  officeLongitude: number
  officeRadiusMeters: number
  updatedAt: Date
  updatedById: string
  updatedByName: string
}

export function defaultAttendanceSettings(): AttendanceSettings {
  return {
    officeName: DEFAULT_OFFICE_NAME,
    officeLatitude: DEFAULT_OFFICE_LATITUDE,
    officeLongitude: DEFAULT_OFFICE_LONGITUDE,
    officeRadiusMeters: DEFAULT_OFFICE_RADIUS_METERS,
    updatedAt: new Date(0),
    updatedById: '',
    updatedByName: '',
  }
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
