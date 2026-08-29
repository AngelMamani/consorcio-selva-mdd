import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers, uniqueUsersByAccessDni } from '@/domain/entities/User'
import type { Area } from '@/domain/entities/Area'
import { isMeterChangeArea } from '@/domain/entities/Area'
import type {
  MeterChangeOrder,
  MeterChangeOrderDraft,
} from '@/domain/entities/MeterChangeOrder'
import {
  draftFromMeterChangeOrder,
  meterChangeDoneFlagStorage,
  meterChangeSystemFromValue,
  buildMeterChangePedido,
} from '@/domain/entities/MeterChangeOrder'
import type { MeterChangeOrderRepository } from '@/domain/repositories/MeterChangeOrderRepository'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { hasAssignedRole, UserRole } from '@/domain/value-objects/UserRole'
import type {
  MeterChangeOrderExcelExportService,
  MeterChangeOrderExportFile,
  MeterChangeOrderPdfExportService,
} from '@/domain/repositories/MeterChangeOrderExportService'

const ORDER_NUMBER_PATTERN = /^\d{8,20}$/
const SUPPLY_PATTERN = /^$|^\d{7,15}$/
const ROUTE_PATTERN = /^$|^\d{7,15}$/

function clip(value: string, max: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, max)
}

function digits(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizeMeterChangeOrderDraft(
  input: MeterChangeOrderDraft,
): MeterChangeOrderDraft {
  const orderNumber = digits(input.orderNumber)
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
    throw new ValidationError('El número de OT debe tener entre 8 y 20 dígitos')
  }

  const supplyCode = digits(input.supplyCode)
  if (!SUPPLY_PATTERN.test(supplyCode)) {
    throw new ValidationError('El suministro debe tener entre 7 y 15 dígitos')
  }

  const routeCode = digits(input.routeCode)
  if (!ROUTE_PATTERN.test(routeCode)) {
    throw new ValidationError('El código de ruta debe tener entre 7 y 15 dígitos')
  }

  const technicianId = clip(input.technicianId, 80)
  const technicianName = clip(input.technicianName, 120).toUpperCase()
  const scheduledDate = input.scheduledDate
  if (technicianId && !scheduledDate) {
    throw new ValidationError('La fecha programada es obligatoria al asignar')
  }

  const latitude =
    typeof input.latitude === 'number' && Number.isFinite(input.latitude)
      ? input.latitude
      : null
  const longitude =
    typeof input.longitude === 'number' && Number.isFinite(input.longitude)
      ? input.longitude
      : null

  return {
    orderNumber,
    pedido: buildMeterChangePedido({
      technicianName,
      typeCode: 'CM',
      scheduledDate: technicianId ? scheduledDate : null,
    }),
    customerName: clip(input.customerName, 160).toUpperCase(),
    address: clip(input.address, 220).toUpperCase(),
    supplyCode,
    routeCode,
    meterSerial: clip(input.meterSerial, 40),
    typeCode: 'CM',
    systemType: meterChangeSystemFromValue(input.systemType),
    changeDoneFlag: meterChangeDoneFlagStorage(input.changeDoneFlag),
    observations: clip(input.observations, 500),
    latitude,
    longitude,
    technicianId: technicianId && technicianName ? technicianId : '',
    technicianName: technicianId ? technicianName : '',
    scheduledDate: technicianId ? scheduledDate : null,
  }
}

function assertCanRead(actor: User): void {
  if (!actor.active) {
    throw new UnauthorizedError('Usuario inactivo')
  }
}

function assertCanManage(actor: User): void {
  if (!assertUserCanManageUsers(actor)) {
    throw new UnauthorizedError(
      'Solo administradores pueden gestionar cambios de medidor',
    )
  }
}

function normalizeNameKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export class ListMeterChangeOrdersUseCase {
  private readonly repository: MeterChangeOrderRepository

  constructor(repository: MeterChangeOrderRepository) {
    this.repository = repository
  }

  watch(
    actor: User,
    areaId: string,
    onChange: (orders: MeterChangeOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    assertCanRead(actor)
    return this.repository.watchByArea(areaId.trim(), onChange, onError)
  }
}

export class UpsertMeterChangeOrderUseCase {
  private readonly repository: MeterChangeOrderRepository
  private readonly areaRepository: AreaRepository

  constructor(
    repository: MeterChangeOrderRepository,
    areaRepository: AreaRepository,
  ) {
    this.repository = repository
    this.areaRepository = areaRepository
  }

  async execute(
    actor: User,
    areaId: string,
    input: MeterChangeOrderDraft,
  ): Promise<MeterChangeOrder> {
    assertCanManage(actor)
    const area = await this.requireMeterChangeArea(areaId)
    const normalized = normalizeMeterChangeOrderDraft(input)
    return this.repository.upsert(area.id, area.name, normalized, {
      id: actor.id,
      name: actor.displayName,
    })
  }

  private async requireMeterChangeArea(areaId: string): Promise<Area> {
    const area = await this.areaRepository.getById(areaId.trim())
    if (!area) throw new ValidationError('Actividad no encontrada')
    if (!isMeterChangeArea(area)) {
      throw new ValidationError(
        'Esta actividad no es de cambio de medidor. Crea una actividad «Cambio de medidor».',
      )
    }
    return area
  }
}

export class UpdateMeterChangeOrderUseCase {
  private readonly repository: MeterChangeOrderRepository
  private readonly areaRepository: AreaRepository

  constructor(
    repository: MeterChangeOrderRepository,
    areaRepository: AreaRepository,
  ) {
    this.repository = repository
    this.areaRepository = areaRepository
  }

  async execute(
    actor: User,
    orderId: string,
    input: MeterChangeOrderDraft,
  ): Promise<MeterChangeOrder> {
    assertCanManage(actor)
    const existing = await this.repository.getById(orderId.trim())
    if (!existing) throw new ValidationError('Orden no encontrada')
    const area = await this.areaRepository.getById(existing.areaId)
    const normalized = normalizeMeterChangeOrderDraft({
      ...input,
      orderNumber: existing.orderNumber,
    })
    return this.repository.update(
      existing.id,
      area?.name ?? existing.areaName,
      normalized,
    )
  }
}

export class AssignMeterChangeOrderUseCase {
  private readonly repository: MeterChangeOrderRepository
  private readonly areaRepository: AreaRepository

  constructor(
    repository: MeterChangeOrderRepository,
    areaRepository: AreaRepository,
  ) {
    this.repository = repository
    this.areaRepository = areaRepository
  }

  async execute(
    actor: User,
    orderId: string,
    input: {
      technicianId: string
      technicianName: string
      scheduledDate: Date | null
    },
  ): Promise<MeterChangeOrder> {
    assertCanManage(actor)
    const existing = await this.repository.getById(orderId.trim())
    if (!existing) throw new ValidationError('Orden no encontrada')
    const area = await this.areaRepository.getById(existing.areaId)
    const draft: MeterChangeOrderDraft = {
      ...draftFromMeterChangeOrder(existing),
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      scheduledDate: input.scheduledDate,
    }
    const normalized = normalizeMeterChangeOrderDraft(draft)
    return this.repository.update(
      existing.id,
      area?.name ?? existing.areaName,
      normalized,
    )
  }
}

export class DeleteMeterChangeOrderUseCase {
  private readonly repository: MeterChangeOrderRepository

  constructor(repository: MeterChangeOrderRepository) {
    this.repository = repository
  }

  async execute(actor: User, orderId: string): Promise<void> {
    assertCanManage(actor)
    const existing = await this.repository.getById(orderId.trim())
    if (!existing) throw new ValidationError('Orden no encontrada')
    await this.repository.delete(existing.id)
  }
}

export class ImportMeterChangeOrdersUseCase {
  private readonly repository: MeterChangeOrderRepository
  private readonly areaRepository: AreaRepository
  private readonly userRepository: UserRepository

  constructor(
    repository: MeterChangeOrderRepository,
    areaRepository: AreaRepository,
    userRepository: UserRepository,
  ) {
    this.repository = repository
    this.areaRepository = areaRepository
    this.userRepository = userRepository
  }

  async execute(
    actor: User,
    areaId: string,
    drafts: MeterChangeOrderDraft[],
  ): Promise<{ created: number; updated: number }> {
    assertCanManage(actor)
    const area = await this.areaRepository.getById(areaId.trim())
    if (!area) throw new ValidationError('Actividad no encontrada')
    if (!isMeterChangeArea(area)) {
      throw new ValidationError(
        'Importa este Excel solo en una actividad de cambio de medidor',
      )
    }
    if (drafts.length === 0) {
      throw new ValidationError('El archivo no tiene órdenes para importar')
    }
    if (drafts.length > 5000) {
      throw new ValidationError('El archivo no debe superar 5000 órdenes')
    }

    const technicians = uniqueUsersByAccessDni(
      await this.userRepository.listTechnicians(),
    ).filter((user) => hasAssignedRole(user, UserRole.Tecnico) && user.active)

    const byName = new Map(
      technicians.map((user) => [normalizeNameKey(user.displayName), user]),
    )

    const normalized = drafts.map((draft) => {
      const match = draft.technicianId
        ? technicians.find((user) => user.id === draft.technicianId)
        : byName.get(normalizeNameKey(draft.technicianName))
      const withTech: MeterChangeOrderDraft = match
        ? {
            ...draft,
            technicianId: match.id,
            technicianName: match.displayName.toUpperCase(),
            scheduledDate: draft.scheduledDate ?? new Date(),
          }
        : {
            ...draft,
            technicianId: '',
            technicianName: '',
            scheduledDate: null,
          }
      return normalizeMeterChangeOrderDraft(withTech)
    })

    return this.repository.upsertMany(area.id, area.name, normalized, {
      id: actor.id,
      name: actor.displayName,
    })
  }
}

export class ExportMeterChangeOrdersToPdfUseCase {
  private readonly pdfService: MeterChangeOrderPdfExportService

  constructor(pdfService: MeterChangeOrderPdfExportService) {
    this.pdfService = pdfService
  }

  execute(
    actor: User,
    report: {
      areaName: string
      reportCode: string
      technicianName: string
      date: Date
      orders: MeterChangeOrder[]
    },
  ): MeterChangeOrderExportFile {
    assertCanRead(actor)
    if (report.orders.length === 0) {
      throw new ValidationError('No hay órdenes para exportar')
    }
    return this.pdfService.createDocument({
      ...report,
      generatedByName: actor.displayName,
    })
  }
}

export class ExportMeterChangeOrdersToExcelUseCase {
  private readonly excelService: MeterChangeOrderExcelExportService

  constructor(excelService: MeterChangeOrderExcelExportService) {
    this.excelService = excelService
  }

  execute(
    actor: User,
    report: {
      areaName: string
      reportCode: string
      technicianName: string
      date: Date
      orders: MeterChangeOrder[]
    },
  ): MeterChangeOrderExportFile {
    assertCanRead(actor)
    if (report.orders.length === 0) {
      throw new ValidationError('No hay órdenes para exportar')
    }
    return this.excelService.createWorkbook(report)
  }

  template(actor: User) {
    assertCanRead(actor)
    return this.excelService.createImportTemplate()
  }
}
