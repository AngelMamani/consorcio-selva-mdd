import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import type {
  CatalogStatusPatch,
  NearbySupply,
  ParsedSupply,
  Supply,
  SupplyCatalogStatus,
} from '@/domain/entities/Supply'
import { SED_FEEDER_RADIUS_METERS, supplyHasLocation } from '@/domain/entities/Supply'
import { distanceMeters } from '@/domain/services/GeoDistanceService'
import {
  stationHitFromSed,
  stationHitFromSupply,
  type StationHit,
  type StationSearchScope,
} from '@/domain/entities/StationHit'
import type { ParsedSed } from '@/domain/entities/Sed'
import type { SupplyRepository } from '@/domain/repositories/SupplyRepository'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import {
  isRouteCode,
  normalizeRouteCode,
} from '@/domain/value-objects/RouteCode'
import {
  expandSupplySearch,
  rankSupplyCodes,
  scoreSupplyCode,
  supplyCodeMatchesQuery,
} from '@/domain/services/SupplySearchService'
import {
  buildStationCatalogExportReport,
  STATION_CATALOG_EXPORT_LIMIT,
} from '@/domain/entities/StationCatalogExportReport'
import type {
  StationCatalogExcelExportService,
  StationCatalogExportFile,
} from '@/domain/repositories/StationCatalogExcelExportService'

export class GetSupplyByRouteCodeUseCase {
  private readonly supplyRepository: SupplyRepository

  constructor(supplyRepository: SupplyRepository) {
    this.supplyRepository = supplyRepository
  }

  async execute(actor: User, routeCode: string): Promise<Supply> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const code = normalizeRouteCode(routeCode)
    if (!isRouteCode(code)) {
      throw new ValidationError('Ingresa un código de ruta válido')
    }

    const supply = await this.supplyRepository.getByRouteCode(code)
    if (!supply) {
      throw new NotFoundError('No hay estación con ese código de ruta')
    }
    return supply
  }

  async find(actor: User, routeCode: string): Promise<Supply | null> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    const code = normalizeRouteCode(routeCode)
    if (!isRouteCode(code)) {
      throw new ValidationError('Ingresa un código de ruta válido')
    }
    return this.supplyRepository.getByRouteCode(code)
  }
}

async function searchSuppliesFlexible(
  supplyRepository: SupplyRepository,
  query: string,
  limit: number,
): Promise<Supply[]> {
  const { digits, prefixes, exactCodes } = expandSupplySearch(query)
  if (digits.length > 12) {
    throw new ValidationError('El código de ruta es demasiado largo')
  }
  if (prefixes.length === 0 && exactCodes.length === 0) {
    return []
  }

  const [prefixGroups, exactHits] = await Promise.all([
    Promise.all(
      prefixes.map((prefix) => supplyRepository.searchByPrefix(prefix, limit)),
    ),
    Promise.all(exactCodes.map((code) => supplyRepository.getByRouteCode(code))),
  ])

  const byCode = new Map<string, Supply>()
  for (const supply of exactHits) {
    if (supply) byCode.set(supply.routeCode, supply)
  }
  for (const group of prefixGroups) {
    for (const supply of group) {
      byCode.set(supply.routeCode, supply)
    }
  }

  return rankSupplyCodes(
    [...byCode.values()].filter((supply) =>
      supplyCodeMatchesQuery(supply.routeCode, digits),
    ),
    digits,
    (supply) => supply.routeCode,
  ).slice(0, limit)
}

export class SearchSuppliesUseCase {
  private readonly supplyRepository: SupplyRepository

  constructor(supplyRepository: SupplyRepository) {
    this.supplyRepository = supplyRepository
  }

  async execute(actor: User, query: string): Promise<Supply[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    return searchSuppliesFlexible(this.supplyRepository, query, 20)
  }
}

export class ListSupplyCatalogUseCase {
  private readonly supplyRepository: SupplyRepository

  constructor(supplyRepository: SupplyRepository) {
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    query: string,
    limit = 48,
  ): Promise<Supply[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    return searchSuppliesFlexible(this.supplyRepository, query, limit)
  }
}

export class GetStationByCodeUseCase {
  private readonly supplyRepository: SupplyRepository

  constructor(supplyRepository: SupplyRepository) {
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    routeCode: string,
    scope: StationSearchScope = 'all',
  ): Promise<StationHit> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const { exactCodes } = expandSupplySearch(routeCode)
    const code = normalizeRouteCode(routeCode)
    const sedCode =
      code.match(/20\d{5}/)?.[0] ?? (/^20\d{5}$/.test(code) ? code : null)

    if (scope !== 'supply' && sedCode) {
      const sed = await this.supplyRepository.getSedByCode(sedCode)
      if (sed) return stationHitFromSed(sed)
    }

    if (scope !== 'sed') {
      const candidates = [...new Set([code, ...exactCodes])].filter(isRouteCode)
      for (const candidate of candidates) {
        const supply = await this.supplyRepository.getByRouteCode(candidate)
        if (supply) return stationHitFromSupply(supply)
      }
    }

    if (scope === 'supply') {
      throw new NotFoundError('No hay suministro con ese código')
    }
    if (scope === 'sed') {
      throw new NotFoundError('No hay SED con ese código')
    }
    throw new NotFoundError('No hay suministro ni SED con ese código')
  }
}

export class SearchStationsUseCase {
  private readonly supplyRepository: SupplyRepository

  constructor(supplyRepository: SupplyRepository) {
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    query: string,
    options: { scope?: StationSearchScope; limit?: number } = {},
  ): Promise<StationHit[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const scope = options.scope ?? 'all'
    const perKindLimit = Math.min(
      Math.max(options.limit ?? (scope === 'all' ? 16 : 40), 1),
      80,
    )

    const { digits, prefixes } = expandSupplySearch(query)
    if (digits.length > 12) {
      throw new ValidationError('El código es demasiado largo')
    }
    if (prefixes.length === 0) {
      return []
    }

    const wantSupplies = scope === 'all' || scope === 'supply'
    const wantSeds = scope === 'all' || scope === 'sed'

    const [supplies, sedGroups] = await Promise.all([
      wantSupplies
        ? searchSuppliesFlexible(this.supplyRepository, query, perKindLimit)
        : Promise.resolve([]),
      wantSeds
        ? Promise.all(
            prefixes.map((prefix) =>
              this.supplyRepository.searchSedsByPrefix(prefix, perKindLimit),
            ),
          )
        : Promise.resolve([]),
    ])

    const seds = new Map(
      sedGroups.flat().map((sed) => [sed.code, sed] as const),
    )

    const supplyHits = wantSupplies
      ? rankSupplyCodes(supplies, digits, (supply) => supply.routeCode)
          .map(stationHitFromSupply)
      : []

    const sedHits = wantSeds
      ? rankSupplyCodes([...seds.values()], digits, (sed) => sed.code).map(
          stationHitFromSed,
        )
      : []

    if (scope === 'supply') return supplyHits.slice(0, perKindLimit)
    if (scope === 'sed') return sedHits.slice(0, perKindLimit)

    const mixed: StationHit[] = [...sedHits, ...supplyHits]
    mixed.sort((left, right) => {
      const leftScore = scoreSupplyCode(left.code, digits)
      const rightScore = scoreSupplyCode(right.code, digits)
      if (leftScore !== rightScore) return leftScore - rightScore
      if (left.kind !== right.kind) return left.kind === 'sed' ? -1 : 1
      return left.code.localeCompare(right.code)
    })
    return mixed
  }
}

export class ListSuppliesNearUseCase {
  private readonly supplyRepository: SupplyRepository

  constructor(supplyRepository: SupplyRepository) {
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    latitude: number,
    longitude: number,
    radiusMeters = SED_FEEDER_RADIUS_METERS,
  ): Promise<NearbySupply[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const supplies = await this.supplyRepository.listNear(
      latitude,
      longitude,
      radiusMeters,
      250,
    )

    const nearby: NearbySupply[] = supplies
      .filter(supplyHasLocation)
      .map((supply) => ({
        id: supply.id,
        routeCode: supply.routeCode,
        latitude: supply.latitude,
        longitude: supply.longitude,
        distanceMeters: distanceMeters(
          latitude,
          longitude,
          supply.latitude,
          supply.longitude,
        ),
      }))

    nearby.sort((left, right) => left.distanceMeters - right.distanceMeters)
    return nearby
  }
}

export class GetSupplyCatalogStatusUseCase {
  private readonly supplyRepository: SupplyRepository

  constructor(supplyRepository: SupplyRepository) {
    this.supplyRepository = supplyRepository
  }

  async execute(actor: User): Promise<SupplyCatalogStatus | null> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    return this.supplyRepository.getCatalogStatus()
  }
}

export class ImportSuppliesUseCase {
  private readonly supplyRepository: SupplyRepository

  constructor(supplyRepository: SupplyRepository) {
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    input: {
      supplies: ParsedSupply[]
      skipped: number
      onProgress?: (done: number, total: number) => void
    },
  ): Promise<SupplyCatalogStatus> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede importar estaciones',
      )
    }
    if (input.supplies.length === 0) {
      throw new ValidationError(
        'El KML no tiene estaciones con código de ruta válido',
      )
    }

    await this.supplyRepository.upsertMany(input.supplies, input.onProgress)

    return this.supplyRepository.saveCatalogStatus({
      count: input.supplies.length,
      skipped: input.skipped,
      importedById: actor.id,
      importedByName: actor.displayName,
    })
  }
}

export class ImportSedsUseCase {
  private readonly supplyRepository: SupplyRepository

  constructor(supplyRepository: SupplyRepository) {
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    input: {
      seds: ParsedSed[]
      skipped: number
      onProgress?: (done: number, total: number) => void
    },
  ): Promise<SupplyCatalogStatus> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo el administrador puede importar SEDs')
    }
    if (input.seds.length === 0) {
      throw new ValidationError('El KML no tiene SEDs con código válido')
    }

    await this.supplyRepository.upsertSeds(input.seds, input.onProgress)

    return this.supplyRepository.saveCatalogStatus({
      sedCount: input.seds.length,
      skippedSeds: input.skipped,
      importedById: actor.id,
      importedByName: actor.displayName,
    } satisfies CatalogStatusPatch)
  }
}

export class ExportStationCatalogToExcelUseCase {
  private readonly supplyRepository: SupplyRepository
  private readonly excelService: StationCatalogExcelExportService

  constructor(
    supplyRepository: SupplyRepository,
    excelService: StationCatalogExcelExportService,
  ) {
    this.supplyRepository = supplyRepository
    this.excelService = excelService
  }

  async execute(
    actor: User,
    limit = STATION_CATALOG_EXPORT_LIMIT,
  ): Promise<StationCatalogExportFile> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede exportar el catálogo',
      )
    }

    const safeLimit = Math.min(Math.max(Math.round(limit), 1), 500)

    const [supplies, seds, catalog] = await Promise.all([
      this.supplyRepository.listFirstSupplies(safeLimit),
      this.supplyRepository.listFirstSeds(safeLimit),
      this.supplyRepository.getCatalogStatus(),
    ])

    if (supplies.length === 0 && seds.length === 0) {
      throw new ValidationError(
        'No hay suministros ni SEDs para exportar. Importa los KML primero.',
      )
    }

    return this.excelService.createWorkbook(
      buildStationCatalogExportReport({
        supplies,
        seds,
        catalog,
        generatedByName: actor.displayName,
        exportLimit: safeLimit,
      }),
    )
  }
}
