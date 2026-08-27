export interface Supply {
  id: string
  routeCode: string
  latitude: number | null
  longitude: number | null
  prefix: string
  note: string
  updatedAt: Date
}

export interface SupplyCatalogStatus {
  count: number
  sedCount: number
  skipped: number
  skippedSeds: number
  importedAt: Date
  importedById: string
  importedByName: string
}

export interface CatalogStatusPatch {
  count?: number
  sedCount?: number
  skipped?: number
  skippedSeds?: number
  importedById: string
  importedByName: string
}

export interface ParsedSupply {
  routeCode: string
  latitude: number
  longitude: number
}

export interface NearbySupply {
  id: string
  routeCode: string
  latitude: number
  longitude: number
  distanceMeters: number
}

/** Radio para inferir qué medidores alimenta una SED (el KML no trae el cruce). */
export const SED_FEEDER_RADIUS_METERS = 300

export function supplyHasLocation(
  supply: Pick<Supply, 'latitude' | 'longitude'>,
): supply is Supply & { latitude: number; longitude: number } {
  return (
    typeof supply.latitude === 'number' &&
    typeof supply.longitude === 'number' &&
    Number.isFinite(supply.latitude) &&
    Number.isFinite(supply.longitude) &&
    !(supply.latitude === 0 && supply.longitude === 0)
  )
}
