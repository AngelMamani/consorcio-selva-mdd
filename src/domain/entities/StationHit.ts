import type { Sed } from '@/domain/entities/Sed'
import type { Supply } from '@/domain/entities/Supply'
import { supplyHasLocation } from '@/domain/entities/Supply'
import { formatRouteCode } from '@/domain/services/SupplySearchService'

export type StationKind = 'supply' | 'sed'
export type StationSearchScope = 'all' | 'supply' | 'sed'

export interface StationHit {
  kind: StationKind
  id: string
  code: string
  title: string
  detail: string
  latitude: number
  longitude: number
  hasLocation: boolean
  prefix?: string
  note?: string
  name?: string
}

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

export function stationHitFromSupply(supply: Supply): StationHit {
  const hasLocation = supplyHasLocation(supply)
  const note = supply.note.trim()
  const detailParts = [
    hasLocation
      ? formatCoords(supply.latitude, supply.longitude)
      : 'Sin coordenadas GPS',
  ]
  if (note) detailParts.push(note)

  return {
    kind: 'supply',
    id: `supply:${supply.id}`,
    code: supply.routeCode,
    title: formatRouteCode(supply.routeCode),
    detail: detailParts.join(' · '),
    latitude: supply.latitude ?? 0,
    longitude: supply.longitude ?? 0,
    hasLocation,
    prefix: supply.prefix || supply.routeCode.slice(0, 4),
    note: note || undefined,
  }
}

export function stationHitFromSed(sed: Sed): StationHit {
  return {
    kind: 'sed',
    id: `sed:${sed.id}`,
    code: sed.code,
    title: sed.code,
    detail: sed.name.trim() || 'SED',
    latitude: sed.latitude,
    longitude: sed.longitude,
    hasLocation: true,
    name: sed.name.trim() || undefined,
  }
}
