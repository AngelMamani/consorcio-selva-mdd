import type { User } from '@/domain/entities/User'
import type { Area } from '@/domain/entities/Area'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
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
    throw new ValidationError('El nombre del área es obligatorio')
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
      throw new UnauthorizedError('Solo administradores pueden crear áreas')
    }

    const name = normalizeName(input.name)
    const existing = await this.areaRepository.findByName(name)
    if (existing) {
      throw new ValidationError('Ya existe un área con ese nombre')
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
      throw new UnauthorizedError('Solo administradores pueden editar áreas')
    }

    const area = await this.areaRepository.getById(areaId)
    if (!area) {
      throw new ValidationError('Área no encontrada')
    }

    const name = normalizeName(input.name)
    const duplicate = await this.areaRepository.findByName(name)
    if (duplicate && duplicate.id !== areaId) {
      throw new ValidationError('Ya existe un área con ese nombre')
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

  constructor(
    areaRepository: AreaRepository,
    folderRepository: ImageFolderRepository,
  ) {
    this.areaRepository = areaRepository
    this.folderRepository = folderRepository
  }

  async execute(actor: User, areaId: string): Promise<void> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo administradores pueden eliminar áreas')
    }

    const area = await this.areaRepository.getById(areaId)
    if (!area) {
      throw new ValidationError('Área no encontrada')
    }

    const folders = await this.folderRepository.listByArea(areaId)
    if (folders.length > 0) {
      throw new ValidationError(
        'No se puede eliminar un área con carpetas. Mueve o elimina las carpetas primero.',
      )
    }

    await this.areaRepository.delete(areaId)
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
    options: { migrateOrphans?: boolean } = {},
  ): Promise<Area> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const migrateOrphans = options.migrateOrphans !== false
    const areas = await this.areaRepository.listAll()
    let area =
      areas.find(
        (item) =>
          item.name.trim().toLowerCase() === DEFAULT_AREA_NAME.toLowerCase(),
      ) ?? null

    if (!area) {
      if (assertUserCanManageUsers(actor)) {
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
