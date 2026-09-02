export const LOCATION_LIVE_MS = 90_000

export interface TechnicianLocation {
  userId: string
  displayName: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  gpsActive: boolean
  updatedAt: Date
}

export function technicianLocationIsLive(
  location: TechnicianLocation,
  now = Date.now(),
): boolean {
  return (
    location.gpsActive && now - location.updatedAt.getTime() <= LOCATION_LIVE_MS
  )
}

export function technicianLocationStatusLabel(
  location: TechnicianLocation,
  now = Date.now(),
): string {
  if (technicianLocationIsLive(location, now)) return 'En vivo'
  if (location.gpsActive) return 'Sin señal'
  return 'GPS apagado'
}

export function formatLocationSeenAt(date: Date): string {
  return date.toLocaleString('es-PE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  })
}
