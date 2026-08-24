/** Distancia en metros entre dos coordenadas (Haversine). */
export function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadius = 6_371_000
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(latitudeB - latitudeA)
  const dLng = toRad(longitudeB - longitudeA)
  const lat1 = toRad(latitudeA)
  const lat2 = toRad(latitudeB)
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

const METERS_PER_DEGREE_LAT = 111_320

export interface GeoBoundingBox {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/** Caja alrededor de un punto, para consultar Firestore por lat/lng. */
export function boundingBox(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): GeoBoundingBox {
  const latDelta = radiusMeters / METERS_PER_DEGREE_LAT
  const lngDelta =
    radiusMeters /
    (METERS_PER_DEGREE_LAT * Math.max(0.2, Math.cos((latitude * Math.PI) / 180)))
  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  }
}
