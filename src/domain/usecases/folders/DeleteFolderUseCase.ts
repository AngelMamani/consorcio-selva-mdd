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

export class DeleteFolderUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly imageRepository: FolderImageRepository

  constructor(
    folderRepository: ImageFolderRepository,
    imageRepository: FolderImageRepository,
  ) {
    this.folderRepository = folderRepository
    this.imageRepository = imageRepository
  }

  async execute(actor: User, folderId: string): Promise<void> {
    if (!assertUserCanDeleteContent(actor)) {
      throw new UnauthorizedError(
        'Los técnicos no pueden eliminar carpetas. Solo el administrador.',
      )
    }

    const folder = await this.folderRepository.getById(folderId)
    if (!folder) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    if (!assertUserCanAccessFolder(actor, folder)) {
      throw new UnauthorizedError('No tienes permiso para eliminar esta carpeta')
    }

    await this.imageRepository.deleteAllByFolder(folderId)
    await this.folderRepository.delete(folderId)
  }
}
