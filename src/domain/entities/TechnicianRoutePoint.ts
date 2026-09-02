export interface TechnicianRoutePoint {
  latitude: number
  longitude: number
  accuracyMeters: number | null
  capturedAt: Date
}

const LIMA_TZ = 'America/Lima'
const ROUTE_GAP_MS = 15 * 60 * 1000

export function limaDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function limaDayBounds(dateKey: string): { start: Date; end: Date } {
  const start = new Date(`${dateKey}T00:00:00-05:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export function splitRouteSegments(
  points: TechnicianRoutePoint[],
  gapMs = ROUTE_GAP_MS,
): TechnicianRoutePoint[][] {
  const segments: TechnicianRoutePoint[][] = []
  let current: TechnicianRoutePoint[] = []
  for (const point of points) {
    const previous = current[current.length - 1]
    if (
      previous &&
      point.capturedAt.getTime() - previous.capturedAt.getTime() > gapMs
    ) {
      if (current.length >= 2) segments.push(current)
      current = [point]
      continue
    }
    current.push(point)
  }
  if (current.length >= 2) segments.push(current)
  return segments
}

export function routeLengthMeters(points: TechnicianRoutePoint[]): number {
  let meters = 0
  for (let index = 1; index < points.length; index += 1) {
    meters += haversineMeters(points[index - 1], points[index])
  }
  return meters
}

export function formatRouteLength(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function haversineMeters(
  from: TechnicianRoutePoint,
  to: TechnicianRoutePoint,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earth = 6371000
  const dLat = toRad(to.latitude - from.latitude)
  const dLng = toRad(to.longitude - from.longitude)
  const lat1 = toRad(from.latitude)
  const lat2 = toRad(to.latitude)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)))
}
