import type {
  CatalogStatusPatch,
  ParsedSupply,
  Supply,
  SupplyCatalogStatus,
} from '@/domain/entities/Supply'
import type { ParsedSed, Sed } from '@/domain/entities/Sed'

export interface SupplyRepository {
  getByRouteCode(routeCode: string): Promise<Supply | null>
  searchByPrefix(prefix: string, limit: number): Promise<Supply[]>
  listNear(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    limit: number,
  ): Promise<Supply[]>
  ensureManual(input: {
    routeCode: string
    note?: string
  }): Promise<Supply>
  setLocation(
    routeCode: string,
    latitude: number,
    longitude: number,
  ): Promise<Supply>
  getSedByCode(code: string): Promise<Sed | null>
  searchSedsByPrefix(prefix: string, limit: number): Promise<Sed[]>
  upsertMany(
    supplies: ParsedSupply[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<void>
  upsertSeds(
    seds: ParsedSed[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<void>
  getCatalogStatus(): Promise<SupplyCatalogStatus | null>
  saveCatalogStatus(status: CatalogStatusPatch): Promise<SupplyCatalogStatus>
}
