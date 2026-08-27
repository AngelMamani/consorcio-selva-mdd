import type { User } from '@/domain/entities/User'
import { assertUserCanAccessFolder } from '@/domain/entities/User'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { FolderDateRepository } from '@/domain/repositories/FolderDateRepository'
import type { FolderImageRepository } from '@/domain/repositories/FolderImageRepository'
import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import { toDateKey } from '@/domain/entities/FolderDate'
import type {
  ActivityPublishedWorkResult,
  ActivityTechnicianFolder,
  PublishedTechnicianWork,
} from '@/domain/entities/TechnicianActivityWork'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'
import { hasAssignedRole, UserRole } from '@/domain/value-objects/UserRole'

function workKey(technicianId: string, folderId: string, dateId: string): string {
  return `${technicianId}|${folderId}|${dateId}`
}

export class ListActivityPublishedWorkUseCase {
  private readonly areaRepository: AreaRepository
  private readonly folderRepository: ImageFolderRepository
  private readonly dateRepository: FolderDateRepository
  private readonly imageRepository: FolderImageRepository
  private readonly userRepository: UserRepository

  constructor(
    areaRepository: AreaRepository,
    folderRepository: ImageFolderRepository,
    dateRepository: FolderDateRepository,
    imageRepository: FolderImageRepository,
    userRepository: UserRepository,
  ) {
    this.areaRepository = areaRepository
    this.folderRepository = folderRepository
    this.dateRepository = dateRepository
    this.imageRepository = imageRepository
    this.userRepository = userRepository
  }

  async execute(
    actor: User,
    areaId: string,
  ): Promise<ActivityPublishedWorkResult> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    const trimmedAreaId = areaId.trim()
    if (!trimmedAreaId) {
      throw new ValidationError('Actividad inválida')
    }

    const area = await this.areaRepository.getById(trimmedAreaId)
    if (!area) {
      throw new ValidationError('Actividad no encontrada')
    }

    const [folders, technicians] = await Promise.all([
      this.folderRepository.listByArea(trimmedAreaId),
      this.userRepository.listTechnicians(),
    ])

    const visibleFolders = folders.filter((folder) =>
      assertUserCanAccessFolder(actor, folder),
    )
    const folderIds = visibleFolders.map((folder) => folder.id)

    const [images, dates] = await Promise.all([
      this.imageRepository.listByFolderIds(folderIds),
      this.dateRepository.listByFolderIds(folderIds),
    ])

    const folderById = new Map(visibleFolders.map((folder) => [folder.id, folder]))
    const dateById = new Map(dates.map((item) => [item.id, item]))

    const worksByKey = new Map<
      string,
      PublishedTechnicianWork & { latest: Date }
    >()

    for (const image of images) {
      const technicianId = image.uploadedById.trim()
      if (!technicianId) continue
      const dateId = image.dateId.trim()
      if (!dateId) continue
      const folder = folderById.get(image.folderId)
      if (!folder) continue
      const folderDate = dateById.get(image.dateId)
      const dateKey =
        folderDate?.dateKey || toDateKey(image.createdAt)
      const key = workKey(technicianId, image.folderId, dateId)
      const existing = worksByKey.get(key)
      if (existing) {
        existing.imageCount += 1
        if (image.createdAt.getTime() > existing.latest.getTime()) {
          existing.latest = image.createdAt
          existing.publishedAt = image.createdAt
        }
        continue
      }

      worksByKey.set(key, {
        technicianId,
        technicianName: image.uploadedByName.trim() || 'Técnico',
        folderId: image.folderId,
        dateId,
        routeCode: folder.routeCode || '',
        folderName: folder.name,
        dateKey,
        imageCount: 1,
        publishedAt: image.createdAt,
        latest: image.createdAt,
      })
    }

    const works = [...worksByKey.values()]
      .map(({ latest: _latest, ...work }) => work)
      .sort((left, right) => {
        const byDate = right.dateKey.localeCompare(left.dateKey)
        if (byDate !== 0) return byDate
        return (left.routeCode || left.folderName).localeCompare(
          right.routeCode || right.folderName,
        )
      })

    const statsByTechnician = new Map<
      string,
      { workCount: number; imageCount: number; lastPublishedAt: Date | null; name: string }
    >()
    for (const work of works) {
      const current = statsByTechnician.get(work.technicianId) ?? {
        workCount: 0,
        imageCount: 0,
        lastPublishedAt: null,
        name: work.technicianName,
      }
      current.workCount += 1
      current.imageCount += work.imageCount
      if (
        !current.lastPublishedAt ||
        work.publishedAt.getTime() > current.lastPublishedAt.getTime()
      ) {
        current.lastPublishedAt = work.publishedAt
      }
      if (work.technicianName) current.name = work.technicianName
      statsByTechnician.set(work.technicianId, current)
    }

    const technicianFolders = new Map<string, ActivityTechnicianFolder>()
    for (const technician of technicians) {
      if (!technician.active || !hasAssignedRole(technician, UserRole.Tecnico)) {
        continue
      }
      const stats = statsByTechnician.get(technician.id)
      technicianFolders.set(technician.id, {
        technicianId: technician.id,
        technicianName: technician.displayName,
        workCount: stats?.workCount ?? 0,
        imageCount: stats?.imageCount ?? 0,
        lastPublishedAt: stats?.lastPublishedAt ?? null,
      })
    }
    for (const [technicianId, stats] of statsByTechnician) {
      if (technicianFolders.has(technicianId)) continue
      technicianFolders.set(technicianId, {
        technicianId,
        technicianName: stats.name,
        workCount: stats.workCount,
        imageCount: stats.imageCount,
        lastPublishedAt: stats.lastPublishedAt,
      })
    }

    const technicianList = [...technicianFolders.values()].sort((left, right) => {
      if (right.workCount !== left.workCount) {
        return right.workCount - left.workCount
      }
      return left.technicianName.localeCompare(right.technicianName, 'es')
    })

    return {
      areaId: area.id,
      areaName: area.name,
      technicians: technicianList,
      works,
    }
  }
}
