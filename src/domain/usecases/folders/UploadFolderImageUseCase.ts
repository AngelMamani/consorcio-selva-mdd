import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { FolderDateRepository } from '@/domain/repositories/FolderDateRepository'
import type { FolderImageRepository } from '@/domain/repositories/FolderImageRepository'
import type { ImageFilePayload } from '@/domain/repositories/FolderImageRepository'
import type { FolderImage } from '@/domain/entities/FolderImage'
import type { User } from '@/domain/entities/User'
import { assertUserCanAccessFolder } from '@/domain/entities/User'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_SIZE_BYTES = 10 * 1024 * 1024

export class UploadFolderImageUseCase {
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

  async execute(
    actor: User,
    folderId: string,
    dateId: string,
    file: ImageFilePayload,
  ): Promise<FolderImage> {
    const folder = await this.folderRepository.getById(folderId)
    if (!folder) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    if (!assertUserCanAccessFolder(actor, folder)) {
      throw new UnauthorizedError('No tienes permiso para subir a esta carpeta')
    }

    const folderDate = await this.dateRepository.getById(dateId)
    if (!folderDate || folderDate.folderId !== folderId) {
      throw new ValidationError(
        'Primero crea una fecha para subir las imágenes',
      )
    }

    if (!ALLOWED_TYPES.has(file.contentType)) {
      throw new ValidationError('Solo se permiten imágenes JPG, PNG, WEBP o GIF')
    }

    if (file.sizeBytes <= 0 || file.sizeBytes > MAX_SIZE_BYTES) {
      throw new ValidationError('La imagen no debe superar 10 MB')
    }

    const image = await this.imageRepository.create({
      folderId,
      dateId,
      file,
      uploadedById: actor.id,
      uploadedByName: actor.displayName,
    })

    await Promise.all([
      this.folderRepository.incrementImageCount(folderId, 1),
      this.dateRepository.incrementImageCount(dateId, 1),
    ])
    return image
  }
}
