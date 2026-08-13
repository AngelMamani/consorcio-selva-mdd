import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { User } from '@/domain/entities/User'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'

export interface CreateFolderRequest {
  name: string
  description: string
}

export class CreateFolderUseCase {
  private readonly folderRepository: ImageFolderRepository

  constructor(folderRepository: ImageFolderRepository) {
    this.folderRepository = folderRepository
  }

  async execute(actor: User, request: CreateFolderRequest): Promise<ImageFolder> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    const name = request.name.trim()
    const description = request.description.trim()

    if (!name) {
      throw new ValidationError('El nombre de la carpeta es obligatorio')
    }

    return this.folderRepository.create({
      name,
      description,
      ownerId: actor.id,
      ownerName: actor.displayName,
    })
  }
}
