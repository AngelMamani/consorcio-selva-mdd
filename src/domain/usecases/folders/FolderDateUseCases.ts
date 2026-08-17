import type { FolderDate } from '@/domain/entities/FolderDate'
import {
  formatDateKey,
  isDateKey,
  toDateKey,
} from '@/domain/entities/FolderDate'
import type { User } from '@/domain/entities/User'
import { assertUserCanAccessFolder, assertUserCanDeleteContent } from '@/domain/entities/User'
import type { FolderDateRepository } from '@/domain/repositories/FolderDateRepository'
import type { FolderImageRepository } from '@/domain/repositories/FolderImageRepository'
import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

async function getAccessibleFolder(
  folderRepository: ImageFolderRepository,
  actor: User,
  folderId: string,
) {
  const folder = await folderRepository.getById(folderId)
  if (!folder) {
    throw new NotFoundError('Carpeta no encontrada')
  }
  if (!assertUserCanAccessFolder(actor, folder)) {
    throw new UnauthorizedError('No tienes permiso para esta carpeta')
  }
  return folder
}

export class ListFolderDatesUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly dateRepository: FolderDateRepository

  constructor(
    folderRepository: ImageFolderRepository,
    dateRepository: FolderDateRepository,
  ) {
    this.folderRepository = folderRepository
    this.dateRepository = dateRepository
  }

  async execute(actor: User, folderId: string): Promise<FolderDate[]> {
    await getAccessibleFolder(this.folderRepository, actor, folderId)
    return this.dateRepository.listByFolder(folderId)
  }
}

export class GetFolderDateUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly dateRepository: FolderDateRepository

  constructor(
    folderRepository: ImageFolderRepository,
    dateRepository: FolderDateRepository,
  ) {
    this.folderRepository = folderRepository
    this.dateRepository = dateRepository
  }

  async execute(actor: User, folderId: string, dateId: string) {
    const folder = await getAccessibleFolder(
      this.folderRepository,
      actor,
      folderId,
    )
    const folderDate = await this.dateRepository.getById(dateId)
    if (!folderDate || folderDate.folderId !== folderId) {
      throw new NotFoundError('Fecha no encontrada')
    }
    return { folder, folderDate }
  }
}

export class CreateFolderDateUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly dateRepository: FolderDateRepository

  constructor(
    folderRepository: ImageFolderRepository,
    dateRepository: FolderDateRepository,
  ) {
    this.folderRepository = folderRepository
    this.dateRepository = dateRepository
  }

  async execute(
    actor: User,
    request: { folderId: string; dateKey: string; note?: string },
  ): Promise<FolderDate> {
    await getAccessibleFolder(this.folderRepository, actor, request.folderId)

    const dateKey = request.dateKey.trim() || toDateKey(new Date())
    if (!isDateKey(dateKey)) {
      throw new ValidationError('La fecha no es válida')
    }

    const existing = await this.dateRepository.findByFolderAndDateKey(
      request.folderId,
      dateKey,
    )
    if (existing) {
      throw new ValidationError(
        `Ya existe la fecha ${formatDateKey(dateKey)} en esta carpeta`,
      )
    }

    const note = (request.note ?? '').trim()
    if (note.length > 200) {
      throw new ValidationError('La nota no debe superar 200 caracteres')
    }

    return this.dateRepository.create({
      folderId: request.folderId,
      dateKey,
      note,
      createdById: actor.id,
      createdByName: actor.displayName,
    })
  }
}

export class DeleteFolderDateUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly dateRepository: FolderDateRepository
  private readonly imageRepository: FolderImageRepository

  constructor(
    folderRepository: ImageFolderRepository,
    dateRepository: FolderDateRepository,
    imageRepository: FolderImageRepository,
  ) {
    this.folderRepository = folderRepository
    this.dateRepository = dateRepository
    this.imageRepository = imageRepository
  }

  async execute(actor: User, folderId: string, dateId: string): Promise<void> {
    if (!assertUserCanDeleteContent(actor)) {
      throw new UnauthorizedError(
        'Los técnicos no pueden eliminar fechas. Solo el administrador.',
      )
    }

    await getAccessibleFolder(this.folderRepository, actor, folderId)
    const folderDate = await this.dateRepository.getById(dateId)
    if (!folderDate || folderDate.folderId !== folderId) {
      throw new NotFoundError('Fecha no encontrada')
    }

    const images = await this.imageRepository.listByDate(folderId, dateId)
    await Promise.all(images.map((image) => this.imageRepository.delete(image)))
    if (images.length > 0) {
      await this.folderRepository.incrementImageCount(folderId, -images.length)
    }
    await this.dateRepository.delete(dateId)
  }
}
