import type { Sed } from '@/domain/entities/Sed'
import type { Supply } from '@/domain/entities/Supply'

export type StationKind = 'supply' | 'sed'

export interface StationHit {
  kind: StationKind
  id: string
  code: string
  title: string
  detail: string
  latitude: number
  longitude: number
}

export function stationHitFromSupply(supply: Supply): StationHit {
  return {
    kind: 'supply',
    id: `supply:${supply.id}`,
    code: supply.routeCode,
    title: supply.routeCode,
    detail: 'Suministro · código de ruta',
    latitude: supply.latitude ?? 0,
    longitude: supply.longitude ?? 0,
  }
}

export function stationHitFromSed(sed: Sed): StationHit {
  return {
    kind: 'sed',
    id: `sed:${sed.id}`,
    code: sed.code,
    title: sed.code,
    detail: sed.name,
    latitude: sed.latitude,
    longitude: sed.longitude,
  }
}
