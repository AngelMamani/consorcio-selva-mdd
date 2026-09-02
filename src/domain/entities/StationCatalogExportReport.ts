import type { Sed } from '@/domain/entities/Sed'
import type { Supply, SupplyCatalogStatus } from '@/domain/entities/Supply'

export const STATION_CATALOG_EXPORT_LIMIT = 100

export interface SupplyExportLine {
  routeCode: string
  prefix: string
  latitude: string
  longitude: string
  note: string
  updatedAtLabel: string
}

export interface SedExportLine {
  code: string
  name: string
  latitude: number
  longitude: number
  updatedAtLabel: string
}

export interface StationCatalogExportReport {
  generatedAtLabel: string
  generatedByName: string
  totalSupplies: number
  totalSeds: number
  exportLimit: number
  suppliesExported: number
  sedsExported: number
  supplies: SupplyExportLine[]
  seds: SedExportLine[]
}

function formatCoord(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(6)
}

function formatWhen(date: Date): string {
  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function buildStationCatalogExportReport(input: {
  supplies: Supply[]
  seds: Sed[]
  catalog: SupplyCatalogStatus | null
  generatedByName: string
  exportLimit?: number
}): StationCatalogExportReport {
  const exportLimit = input.exportLimit ?? STATION_CATALOG_EXPORT_LIMIT

  return {
    generatedAtLabel: new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      dateStyle: 'short',
      timeStyle: 'short',
    }),
    generatedByName: input.generatedByName.trim() || '—',
    totalSupplies: input.catalog?.count ?? input.supplies.length,
    totalSeds: input.catalog?.sedCount ?? input.seds.length,
    exportLimit,
    suppliesExported: input.supplies.length,
    sedsExported: input.seds.length,
    supplies: input.supplies.map((supply) => ({
      routeCode: supply.routeCode,
      prefix: supply.prefix,
      latitude: formatCoord(supply.latitude),
      longitude: formatCoord(supply.longitude),
      note: supply.note.trim() || '—',
      updatedAtLabel: formatWhen(supply.updatedAt),
    })),
    seds: input.seds.map((sed) => ({
      code: sed.code,
      name: sed.name,
      latitude: sed.latitude,
      longitude: sed.longitude,
      updatedAtLabel: formatWhen(sed.updatedAt),
    })),
  }
}
