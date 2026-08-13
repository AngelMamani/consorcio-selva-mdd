import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { User } from '@/domain/entities/User'
import { UserRole } from '@/domain/value-objects/UserRole'
import { UnauthorizedError } from '@/domain/errors/DomainError'

export class ListFoldersUseCase {
  private readonly folderRepository: ImageFolderRepository

  constructor(folderRepository: ImageFolderRepository) {
    this.folderRepository = folderRepository
  }

  async execute(actor: User): Promise<ImageFolder[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    if (actor.role === UserRole.Administrador) {
      return this.folderRepository.listAll()
    }

    return this.folderRepository.listByOwner(actor.id)
  }
}
