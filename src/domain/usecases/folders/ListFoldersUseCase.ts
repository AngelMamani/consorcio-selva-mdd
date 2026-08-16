import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { User } from '@/domain/entities/User'
import { assertUserCanAccessFolder } from '@/domain/entities/User'
import { UserRole } from '@/domain/value-objects/UserRole'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'

export class ListFoldersUseCase {
  private readonly folderRepository: ImageFolderRepository

  constructor(folderRepository: ImageFolderRepository) {
    this.folderRepository = folderRepository
  }

  async execute(actor: User, areaId?: string): Promise<ImageFolder[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    const trimmedAreaId = areaId?.trim()

    let folders: ImageFolder[]
    if (actor.role === UserRole.Administrador) {
      folders = trimmedAreaId
        ? await this.folderRepository.listByArea(trimmedAreaId)
        : await this.folderRepository.listAll()
    } else {
      folders = await this.folderRepository.listAccessibleForUser(actor.id)
      if (trimmedAreaId) {
        folders = folders.filter((folder) => folder.areaId === trimmedAreaId)
      }
    }

    return folders.filter((folder) => assertUserCanAccessFolder(actor, folder))
  }
}

export class ListFoldersByAreaUseCase {
  private readonly folderRepository: ImageFolderRepository

  constructor(folderRepository: ImageFolderRepository) {
    this.folderRepository = folderRepository
  }

  async execute(actor: User, areaId: string): Promise<ImageFolder[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    if (!areaId.trim()) {
      throw new ValidationError('Área inválida')
    }
    return new ListFoldersUseCase(this.folderRepository).execute(actor, areaId)
  }
}
