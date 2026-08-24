import type { User } from '@/domain/entities/User'
import type { Area } from '@/domain/entities/Area'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { FolderDateRepository } from '@/domain/repositories/FolderDateRepository'
import type { FolderImageRepository } from '@/domain/repositories/FolderImageRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { assertUserCanManageUsers } from '@/domain/entities/User'

const DEFAULT_AREA_NAME = 'Área de Notificaciones'
const DEFAULT_AREA_DESCRIPTION =
  'Rutas y carpetas del área de notificaciones'

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new ValidationError('El nombre de la actividad es obligatorio')
  }
  if (trimmed.length > 120) {
    throw new ValidationError('El nombre no debe superar 120 caracteres')
  }
  return trimmed
}

function normalizeDescription(description: string): string {
  const trimmed = description.trim()
  if (trimmed.length > 500) {
    throw new ValidationError('La descripción no debe superar 500 caracteres')
  }
  return trimmed
}

export class ListAreasUseCase {
  private readonly areaRepository: AreaRepository

  constructor(areaRepository: AreaRepository) {
    this.areaRepository = areaRepository
  }

  async execute(actor: User): Promise<Area[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    return this.areaRepository.listAll()
  }
}

export class GetAreaUseCase {
  private readonly areaRepository: AreaRepository

  constructor(areaRepository: AreaRepository) {
    this.areaRepository = areaRepository
  }

  async execute(actor: User, areaId: string): Promise<Area> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    const area = await this.areaRepository.getById(areaId)
    if (!area) {
      throw new ValidationError('Área no encontrada')
    }
    return area
  }
}

export class CreateAreaUseCase {
  private readonly areaRepository: AreaRepository

  constructor(areaRepository: AreaRepository) {
    this.areaRepository = areaRepository
  }

  async execute(
    actor: User,
    input: { name: string; description: string },
  ): Promise<Area> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo administradores pueden crear actividades',
      )
    }

    const name = normalizeName(input.name)
    const existing = await this.areaRepository.findByName(name)
    if (existing) {
      throw new ValidationError('Ya existe una actividad con ese nombre')
    }

    return this.areaRepository.create({
      name,
      description: normalizeDescription(input.description),
      createdById: actor.id,
      createdByName: actor.displayName,
    })
  }
}

export class UpdateAreaUseCase {
  private readonly areaRepository: AreaRepository

  constructor(areaRepository: AreaRepository) {
    this.areaRepository = areaRepository
  }

  async execute(
    actor: User,
    areaId: string,
    input: { name: string; description: string },
  ): Promise<Area> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo administradores pueden editar actividades',
      )
    }

    const area = await this.areaRepository.getById(areaId)
    if (!area) {
      throw new ValidationError('Área no encontrada')
    }

    const name = normalizeName(input.name)
    const duplicate = await this.areaRepository.findByName(name)
    if (duplicate && duplicate.id !== areaId) {
      throw new ValidationError('Ya existe una actividad con ese nombre')
    }

    return this.areaRepository.update(areaId, {
      name,
      description: normalizeDescription(input.description),
    })
  }
}

export class DeleteAreaUseCase {
  private readonly areaRepository: AreaRepository
  private readonly folderRepository: ImageFolderRepository
  private readonly dateRepository: FolderDateRepository
  private readonly imageRepository: FolderImageRepository

  constructor(
    areaRepository: AreaRepository,
    folderRepository: ImageFolderRepository,
    dateRepository: FolderDateRepository,
    imageRepository: FolderImageRepository,
  ) {
    this.areaRepository = areaRepository
    this.folderRepository = folderRepository
    this.dateRepository = dateRepository
    this.imageRepository = imageRepository
  }

  async execute(actor: User, areaId: string): Promise<void> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo administradores pueden eliminar actividades',
      )
    }

    const trimmedId = areaId.trim()
    if (!trimmedId) {
      throw new ValidationError('Actividad no encontrada')
    }

    await this.areaRepository.delete(trimmedId)
    void this.purgeRelated(trimmedId)
  }

  private async purgeRelated(areaId: string): Promise<void> {
    try {
      const folders = await this.folderRepository.listByArea(areaId)
      await Promise.all(
        folders.map(async (folder) => {
          await this.imageRepository
            .deleteAllByFolder(folder.id)
            .catch(() => undefined)
          await this.dateRepository
            .deleteAllByFolder(folder.id)
            .catch(() => undefined)
          await this.folderRepository.delete(folder.id).catch(() => undefined)
        }),
      )
    } catch (error) {
      console.error('No se pudieron borrar todas las carpetas de la actividad', error)
    }
  }
}

/** Crea "Área de Notificaciones" si falta y opcionalmente asigna carpetas sin área. */
export class EnsureDefaultNotificationsAreaUseCase {
  private readonly areaRepository: AreaRepository
  private readonly folderRepository: ImageFolderRepository

  constructor(
    areaRepository: AreaRepository,
    folderRepository: ImageFolderRepository,
  ) {
    this.areaRepository = areaRepository
    this.folderRepository = folderRepository
  }

  async execute(
    actor: User,
    options: { migrateOrphans?: boolean; createIfMissing?: boolean } = {},
  ): Promise<Area> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const migrateOrphans = options.migrateOrphans !== false
    const createIfMissing = options.createIfMissing !== false
    const areas = await this.areaRepository.listAll()
    let area =
      areas.find(
        (item) =>
          item.name.trim().toLowerCase() === DEFAULT_AREA_NAME.toLowerCase(),
      ) ?? null

    if (!area) {
      if (createIfMissing && areas.length === 0 && assertUserCanManageUsers(actor)) {
        area = await this.areaRepository.create({
          name: DEFAULT_AREA_NAME,
          description: DEFAULT_AREA_DESCRIPTION,
          createdById: actor.id,
          createdByName: actor.displayName,
        })
      } else {
        area = areas[0] ?? null
        if (!area) {
          throw new ValidationError(
            'Aún no hay áreas. Un administrador debe crearlas.',
          )
        }
      }
    }

    if (migrateOrphans) {
      const orphanFolders = await this.folderRepository.listWithoutArea()
      if (orphanFolders.length > 0) {
        await Promise.all(
          orphanFolders.map((folder) =>
            this.folderRepository.assignArea(folder.id, {
              areaId: area!.id,
              areaName: area!.name,
            }),
          ),
        )
      }
    }

    return area
  }
}

export { DEFAULT_AREA_NAME }
