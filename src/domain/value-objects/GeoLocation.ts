export interface GeoLocation {
  latitude: number
  longitude: number
  accuracyMeters?: number
  capturedAt?: Date
}

export function isValidGeoLocation(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

export function hasGeoLocation(value: {
  latitude?: number | null
  longitude?: number | null
}): value is { latitude: number; longitude: number } {
  return isValidGeoLocation(value.latitude, value.longitude)
}
