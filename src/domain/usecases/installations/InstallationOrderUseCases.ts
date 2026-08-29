import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import type { Area } from '@/domain/entities/Area'
import { isWorkOrderArea } from '@/domain/entities/Area'
import type {
  InstallationOrder,
  InstallationOrderDraft,
} from '@/domain/entities/InstallationOrder'
import {
  emptyInstallationOrderDraft,
  installationRegisteredFlag,
} from '@/domain/entities/InstallationOrder'
import type { InstallationOrderRepository } from '@/domain/repositories/InstallationOrderRepository'
import type {
  InstallationOrderExcelExportService,
  InstallationOrderExportFile,
  InstallationOrderPdfExportService,
} from '@/domain/repositories/InstallationOrderExportService'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { uniqueUsersByAccessDni } from '@/domain/entities/User'
import { hasAssignedRole, UserRole } from '@/domain/value-objects/UserRole'

const ORDER_NUMBER_PATTERN = /^\d{8,20}$/
const SUPPLY_PATTERN = /^$|^\d{7,15}$/
const NEIGHBOR_PATTERN = /^$|^\d{7,13}$/

function clip(value: string, max: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, max)
}

function digits(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizeInstallationOrderDraft(
  input: InstallationOrderDraft,
): InstallationOrderDraft {
  const orderNumber = digits(input.orderNumber)
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
    throw new ValidationError('El número de OT debe tener entre 8 y 20 dígitos')
  }

  const supplyCode = digits(input.supplyCode)
  if (!SUPPLY_PATTERN.test(supplyCode)) {
    throw new ValidationError('El suministro debe tener entre 7 y 15 dígitos')
  }

  const neighborRouteCode = digits(input.neighborRouteCode)
  if (!NEIGHBOR_PATTERN.test(neighborRouteCode)) {
    throw new ValidationError(
      'El código de ruta vecino debe tener entre 7 y 13 dígitos',
    )
  }

  const technicianId = clip(input.technicianId, 80)
  const technicianName = clip(input.technicianName, 120).toUpperCase()
  const scheduledDate = input.scheduledDate
  if (technicianId && !scheduledDate) {
    throw new ValidationError('La fecha programada es obligatoria al asignar')
  }

  const registeredFlag = installationRegisteredFlag(input.registeredFlag)

  return {
    orderNumber,
    subType: clip(input.subType, 80) || 'INSTALACION NUEVA C1',
    applicantName: clip(input.applicantName, 160).toUpperCase(),
    applicantAddress: clip(input.applicantAddress, 220).toUpperCase(),
    sectorCijp: clip(input.sectorCijp, 80).toUpperCase(),
    sector: clip(input.sector, 80).toUpperCase(),
    supplyCode,
    neighborRouteCode,
    attentionCenter: clip(input.attentionCenter, 80).toUpperCase(),
    executionNotes: clip(input.executionNotes, 500),
    registeredFlag,
    categoryCode: clip(input.categoryCode, 20),
    referenceNumber: digits(input.referenceNumber).slice(0, 20),
    recordedAt: input.recordedAt,
    typeInitials: clip(input.typeInitials, 8).toUpperCase(),
    classification: clip(input.classification, 4).toUpperCase() || 'F',
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
      'Solo administradores pueden gestionar órdenes de instalación',
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

export class ListInstallationOrdersUseCase {
  private readonly repository: InstallationOrderRepository

  constructor(repository: InstallationOrderRepository) {
    this.repository = repository
  }

  execute(actor: User, areaId: string): Promise<InstallationOrder[]> {
    assertCanRead(actor)
    const trimmed = areaId.trim()
    if (!trimmed) throw new ValidationError('Actividad no encontrada')
    return this.repository.listByArea(trimmed)
  }

  watch(
    actor: User,
    areaId: string,
    onChange: (orders: InstallationOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    assertCanRead(actor)
    const trimmed = areaId.trim()
    if (!trimmed) throw new ValidationError('Actividad no encontrada')
    if (assertUserCanManageUsers(actor)) {
      return this.repository.watchByArea(trimmed, onChange, onError)
    }
    return this.repository.watchAssignedTo(
      actor.id,
      (orders) => onChange(orders.filter((item) => item.areaId === trimmed)),
      onError,
    )
  }
}

export class ListMyInstallationOrdersUseCase {
  private readonly repository: InstallationOrderRepository

  constructor(repository: InstallationOrderRepository) {
    this.repository = repository
  }

  watch(
    actor: User,
    onChange: (orders: InstallationOrder[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    assertCanRead(actor)
    return this.repository.watchAssignedTo(actor.id, onChange, onError)
  }
}

export class UpsertInstallationOrderUseCase {
  private readonly repository: InstallationOrderRepository
  private readonly areaRepository: AreaRepository

  constructor(
    repository: InstallationOrderRepository,
    areaRepository: AreaRepository,
  ) {
    this.repository = repository
    this.areaRepository = areaRepository
  }

  async execute(
    actor: User,
    areaId: string,
    draft: InstallationOrderDraft,
  ): Promise<InstallationOrder> {
    assertCanManage(actor)
    const area = await this.requireWorkOrderArea(areaId)
    const normalized = normalizeInstallationOrderDraft(draft)
    const existing = await this.repository.findByOrderNumber(
      area.id,
      normalized.orderNumber,
    )
    if (existing) {
      return this.repository.update(existing.id, area.name, normalized)
    }
    return this.repository.upsert(area.id, area.name, normalized, {
      id: actor.id,
      name: actor.displayName,
    })
  }

  private async requireWorkOrderArea(areaId: string): Promise<Area> {
    const area = await this.areaRepository.getById(areaId.trim())
    if (!area) throw new ValidationError('Actividad no encontrada')
    if (!isWorkOrderArea(area)) {
      throw new ValidationError(
        'Esta actividad usa tareas de rutas, no órdenes de trabajo',
      )
    }
    return area
  }
}

export class UpdateInstallationOrderUseCase {
  private readonly repository: InstallationOrderRepository
  private readonly areaRepository: AreaRepository

  constructor(
    repository: InstallationOrderRepository,
    areaRepository: AreaRepository,
  ) {
    this.repository = repository
    this.areaRepository = areaRepository
  }

  async execute(
    actor: User,
    orderId: string,
    draft: InstallationOrderDraft,
  ): Promise<InstallationOrder> {
    assertCanManage(actor)
    const existing = await this.repository.getById(orderId.trim())
    if (!existing) throw new ValidationError('Orden no encontrada')
    const area = await this.areaRepository.getById(existing.areaId)
    const normalized = normalizeInstallationOrderDraft({
      ...draft,
      orderNumber: existing.orderNumber,
    })
    return this.repository.update(existing.id, area?.name ?? existing.areaName, normalized)
  }
}

export class AssignInstallationOrderUseCase {
  private readonly repository: InstallationOrderRepository
  private readonly areaRepository: AreaRepository

  constructor(
    repository: InstallationOrderRepository,
    areaRepository: AreaRepository,
  ) {
    this.repository = repository
    this.areaRepository = areaRepository
  }

  async execute(
    actor: User,
    orderId: string,
    input: { technicianId: string; technicianName: string; scheduledDate: Date | null },
  ): Promise<InstallationOrder> {
    assertCanManage(actor)
    const existing = await this.repository.getById(orderId.trim())
    if (!existing) throw new ValidationError('Orden no encontrada')
    const area = await this.areaRepository.getById(existing.areaId)
    const draft: InstallationOrderDraft = {
      ...emptyInstallationOrderDraft(),
      ...existing,
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      scheduledDate: input.scheduledDate,
    }
    const normalized = normalizeInstallationOrderDraft(draft)
    return this.repository.update(existing.id, area?.name ?? existing.areaName, normalized)
  }
}

export class DeleteInstallationOrderUseCase {
  private readonly repository: InstallationOrderRepository

  constructor(repository: InstallationOrderRepository) {
    this.repository = repository
  }

  async execute(actor: User, orderId: string): Promise<void> {
    assertCanManage(actor)
    const existing = await this.repository.getById(orderId.trim())
    if (!existing) throw new ValidationError('Orden no encontrada')
    await this.repository.delete(existing.id)
  }
}

export class ImportInstallationOrdersUseCase {
  private readonly repository: InstallationOrderRepository
  private readonly areaRepository: AreaRepository
  private readonly userRepository: UserRepository

  constructor(
    repository: InstallationOrderRepository,
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
    drafts: InstallationOrderDraft[],
  ): Promise<{ created: number; updated: number }> {
    assertCanManage(actor)
    const area = await this.areaRepository.getById(areaId.trim())
    if (!area) throw new ValidationError('Actividad no encontrada')
    if (!isWorkOrderArea(area)) {
      throw new ValidationError(
        'Esta actividad usa tareas de rutas, no órdenes de trabajo',
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
      const withTech: InstallationOrderDraft = match
        ? {
            ...draft,
            technicianId: match.id,
            technicianName: match.displayName.toUpperCase(),
            scheduledDate:
              draft.scheduledDate ?? draft.recordedAt ?? new Date(),
          }
        : {
            ...draft,
            technicianId: '',
            technicianName: '',
            scheduledDate: null,
          }
      return normalizeInstallationOrderDraft(withTech)
    })

    return this.repository.upsertMany(area.id, area.name, normalized, {
      id: actor.id,
      name: actor.displayName,
    })
  }
}

export class ExportInstallationOrdersToPdfUseCase {
  private readonly pdfService: InstallationOrderPdfExportService

  constructor(pdfService: InstallationOrderPdfExportService) {
    this.pdfService = pdfService
  }

  execute(
    actor: User,
    report: {
      areaName: string
      reportCode: string
      technicianName: string
      date: Date
      orders: InstallationOrder[]
    },
  ): InstallationOrderExportFile {
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

export class ExportInstallationOrdersToExcelUseCase {
  private readonly excelService: InstallationOrderExcelExportService

  constructor(excelService: InstallationOrderExcelExportService) {
    this.excelService = excelService
  }

  execute(
    actor: User,
    report: {
      areaName: string
      reportCode: string
      technicianName: string
      date: Date
      orders: InstallationOrder[]
    },
  ): InstallationOrderExportFile {
    assertCanRead(actor)
    if (report.orders.length === 0) {
      throw new ValidationError('No hay órdenes para exportar')
    }
    return this.excelService.createWorkbook({
      ...report,
      generatedByName: actor.displayName,
    })
  }

  template(actor: User): InstallationOrderExportFile {
    assertCanManage(actor)
    return this.excelService.createImportTemplate()
  }
}

