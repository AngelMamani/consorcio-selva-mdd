import type { User } from '@/domain/entities/User'
import type { Area } from '@/domain/entities/Area'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { TaskRepository } from '@/domain/repositories/TaskRepository'
import type { InstallationOrderRepository } from '@/domain/repositories/InstallationOrderRepository'
import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { FolderDateRepository } from '@/domain/repositories/FolderDateRepository'
import type { FolderImageRepository } from '@/domain/repositories/FolderImageRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import {
  AreaAssignmentMode,
  activityNameKey,
  defaultReportCode,
  inferAreaAssignmentMode,
  isAreaAssignmentMode,
  looksLikeInstallationActivity,
  normalizeReportCode,
} from '@/domain/value-objects/AreaAssignmentMode'

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

function findAreaByName(areas: Area[], name: string): Area | undefined {
  const key = activityNameKey(name)
  return areas.find((area) => activityNameKey(area.name) === key)
}

function normalizeDescription(description: string): string {
  const trimmed = description.trim()
  if (trimmed.length > 500) {
    throw new ValidationError('La descripción no debe superar 500 caracteres')
  }
  return trimmed
}

function resolveAssignment(
  name: string,
  assignmentMode?: string | null,
  reportCode?: string | null,
) {
  const mode = isAreaAssignmentMode(assignmentMode)
    ? assignmentMode
    : inferAreaAssignmentMode(name, assignmentMode)
  return {
    assignmentMode: mode,
    reportCode: normalizeReportCode(reportCode ?? '', defaultReportCode(mode, name)),
  }
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
    input: {
      name: string
      description: string
      assignmentMode?: string
      reportCode?: string
    },
  ): Promise<Area> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo administradores pueden crear actividades',
      )
    }

    const name = normalizeName(input.name)
    const all = await this.areaRepository.listAll()
    const existing = findAreaByName(all, name)
    if (existing) {
      throw new ValidationError(
        `Ya existe la actividad “${existing.name}”. Úsala en Tareas; no hace falta crear otra.`,
      )
    }
    if (looksLikeInstallationActivity(name)) {
      const other = all.find((area) => looksLikeInstallationActivity(area.name))
      if (other) {
        throw new ValidationError(
          `Ya existe “${other.name}” para instalaciones. No crees otra: asigna el trabajo en Tareas. Si ves dos, elimina la que sobre.`,
        )
      }
    }

    const assignment = resolveAssignment(
      name,
      input.assignmentMode,
      input.reportCode,
    )

    return this.areaRepository.create({
      name,
      description: normalizeDescription(input.description),
      assignmentMode: assignment.assignmentMode,
      reportCode: assignment.reportCode,
      createdById: actor.id,
      createdByName: actor.displayName,
    })
  }
}

export class UpdateAreaUseCase {
  private readonly areaRepository: AreaRepository
  private readonly taskRepository: TaskRepository
  private readonly installationOrderRepository: InstallationOrderRepository

  constructor(
    areaRepository: AreaRepository,
    taskRepository: TaskRepository,
    installationOrderRepository: InstallationOrderRepository,
  ) {
    this.areaRepository = areaRepository
    this.taskRepository = taskRepository
    this.installationOrderRepository = installationOrderRepository
  }

  async execute(
    actor: User,
    areaId: string,
    input: {
      name: string
      description: string
      assignmentMode?: string
      reportCode?: string
    },
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
    const duplicate = findAreaByName(await this.areaRepository.listAll(), name)
    if (duplicate && duplicate.id !== areaId) {
      throw new ValidationError(
        `Ya existe la actividad “${duplicate.name}”. No dejes dos iguales.`,
      )
    }

    const assignment = resolveAssignment(
      name,
      input.assignmentMode ?? area.assignmentMode,
      input.reportCode ?? area.reportCode,
    )

    const updated = await this.areaRepository.update(areaId, {
      name,
      description: normalizeDescription(input.description),
      assignmentMode: assignment.assignmentMode,
      reportCode: assignment.reportCode,
    })

    if (name !== area.name) {
      await Promise.all([
        this.taskRepository.renameAreaName(areaId, name),
        this.installationOrderRepository.renameAreaName(areaId, name),
      ])
    }

    return updated
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
          assignmentMode: AreaAssignmentMode.Routes,
          reportCode: 'NOT',
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
