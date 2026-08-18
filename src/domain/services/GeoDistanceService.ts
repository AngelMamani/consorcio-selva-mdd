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
