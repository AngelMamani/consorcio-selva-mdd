import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { FolderImageRepository } from '@/domain/repositories/FolderImageRepository'
import type { User } from '@/domain/entities/User'
import {
  assertUserCanAccessFolder,
  assertUserCanDeleteContent,
} from '@/domain/entities/User'
import {
  NotFoundError,
  UnauthorizedError,
} from '@/domain/errors/DomainError'

export class DeleteFolderImageUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly imageRepository: FolderImageRepository

  constructor(
    folderRepository: ImageFolderRepository,
    imageRepository: FolderImageRepository,
  ) {
    this.folderRepository = folderRepository
    this.imageRepository = imageRepository
  }

  async execute(actor: User, folderId: string, imageId: string): Promise<void> {
    if (!assertUserCanDeleteContent(actor)) {
      throw new UnauthorizedError(
        'Los técnicos no pueden eliminar imágenes. Solo el administrador.',
      )
    }

    const folder = await this.folderRepository.getById(folderId)
    if (!folder) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    if (!assertUserCanAccessFolder(actor, folder)) {
      throw new UnauthorizedError('No tienes permiso para eliminar esta imagen')
    }

    const images = await this.imageRepository.listByFolder(folderId)
    const image = images.find((item) => item.id === imageId)
    if (!image) {
      throw new NotFoundError('Imagen no encontrada')
    }

    await this.imageRepository.delete(image)
    await this.folderRepository.incrementImageCount(folderId, -1)
  }
}
