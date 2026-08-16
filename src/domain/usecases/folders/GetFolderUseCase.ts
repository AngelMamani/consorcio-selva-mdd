import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { User } from '@/domain/entities/User'
import { assertUserCanAccessFolder } from '@/domain/entities/User'
import {
  NotFoundError,
  UnauthorizedError,
} from '@/domain/errors/DomainError'

export class GetFolderUseCase {
  private readonly folderRepository: ImageFolderRepository

  constructor(folderRepository: ImageFolderRepository) {
    this.folderRepository = folderRepository
  }

  async execute(actor: User, folderId: string): Promise<ImageFolder> {
    const folder = await this.folderRepository.getById(folderId)
    if (!folder) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    if (!assertUserCanAccessFolder(actor, folder)) {
      throw new UnauthorizedError('No tienes permiso para ver esta carpeta')
    }

    return folder
  }
}
