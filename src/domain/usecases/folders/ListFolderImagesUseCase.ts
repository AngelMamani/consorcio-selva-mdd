import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { FolderImageRepository } from '@/domain/repositories/FolderImageRepository'
import type { FolderImage } from '@/domain/entities/FolderImage'
import type { User } from '@/domain/entities/User'
import { assertUserCanAccessFolder } from '@/domain/entities/User'
import {
  NotFoundError,
  UnauthorizedError,
} from '@/domain/errors/DomainError'

export class ListFolderImagesUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly imageRepository: FolderImageRepository

  constructor(
    folderRepository: ImageFolderRepository,
    imageRepository: FolderImageRepository,
  ) {
    this.folderRepository = folderRepository
    this.imageRepository = imageRepository
  }

  async execute(actor: User, folderId: string): Promise<FolderImage[]> {
    const folder = await this.folderRepository.getById(folderId)
    if (!folder) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    if (!assertUserCanAccessFolder(actor, folder)) {
      throw new UnauthorizedError('No tienes permiso para ver esta carpeta')
    }

    return this.imageRepository.listByFolder(folderId)
  }
}
