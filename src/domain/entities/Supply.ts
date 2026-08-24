export interface Supply {
  id: string
  routeCode: string
  latitude: number
  longitude: number
  prefix: string
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
