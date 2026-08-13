import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { User } from '@/domain/entities/User'
import { assertUserCanEditFolder } from '@/domain/entities/User'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export interface UpdateFolderRequest {
  folderId: string
  name: string
  description: string
}

export class UpdateFolderUseCase {
  private readonly folderRepository: ImageFolderRepository

  constructor(folderRepository: ImageFolderRepository) {
    this.folderRepository = folderRepository
  }

  async execute(actor: User, request: UpdateFolderRequest): Promise<ImageFolder> {
    const folder = await this.folderRepository.getById(request.folderId)
    if (!folder) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    if (!assertUserCanEditFolder(actor, folder.ownerId)) {
      throw new UnauthorizedError('No tienes permiso para editar esta carpeta')
    }

    const name = request.name.trim()
    const description = request.description.trim()

    if (!name) {
      throw new ValidationError('El nombre de la carpeta es obligatorio')
    }

    return this.folderRepository.update(request.folderId, {
      name,
      description,
    })
  }
}
