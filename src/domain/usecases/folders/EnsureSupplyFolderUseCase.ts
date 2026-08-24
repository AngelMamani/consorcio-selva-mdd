import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { SupplyRepository } from '@/domain/repositories/SupplyRepository'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { User } from '@/domain/entities/User'
import { assertUserCanAccessFolder } from '@/domain/entities/User'
import { supplyFolderDocId } from '@/domain/services/SupplyFolderService'
import {
  isRouteCode,
  normalizeRouteCode,
} from '@/domain/value-objects/RouteCode'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export class EnsureSupplyFolderUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly areaRepository: AreaRepository
  private readonly supplyRepository: SupplyRepository

  constructor(
    folderRepository: ImageFolderRepository,
    areaRepository: AreaRepository,
    supplyRepository: SupplyRepository,
  ) {
    this.folderRepository = folderRepository
    this.areaRepository = areaRepository
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    areaId: string,
    routeCode: string,
    hints?: { areaName?: string },
  ): Promise<ImageFolder> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    const code = normalizeRouteCode(routeCode)
    if (!isRouteCode(code)) {
      throw new ValidationError('Ingresa un código de suministro válido')
    }

    const trimmedAreaId = areaId.trim()
    if (!trimmedAreaId) {
      throw new ValidationError('Debes indicar el área')
    }

    const folderId = supplyFolderDocId(trimmedAreaId, code)
    const hintName = hints?.areaName?.trim()

    const [existing, supply, area] = await Promise.all([
      this.folderRepository.getById(folderId),
      this.supplyRepository.getByRouteCode(code),
      hintName
        ? Promise.resolve(null)
        : this.areaRepository.getById(trimmedAreaId),
    ])

    if (existing) {
      if (!assertUserCanAccessFolder(actor, existing)) {
        throw new UnauthorizedError('No tienes permiso para ver esta carpeta')
      }
      return existing
    }

    if (!supply) {
      throw new NotFoundError('No hay suministro con ese código')
    }

    const areaName = hintName || area?.name || ''
    if (!areaName) {
      throw new NotFoundError('Área no encontrada')
    }

    return this.folderRepository.create({
      id: folderId,
      areaId: trimmedAreaId,
      areaName,
      name: code,
      description: 'Suministro',
      ownerId: actor.id,
      ownerName: actor.displayName,
      assignToAllTechnicians: true,
      assignedTechnicianIds: [],
      assignedTechnicianNames: [],
      routeCode: code,
      location: {
        latitude: supply.latitude,
        longitude: supply.longitude,
      },
    })
  }
}
