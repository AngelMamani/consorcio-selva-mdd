import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { User } from '@/domain/entities/User'
import { assertUserCanEditFolder } from '@/domain/entities/User'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { resolveAssignments } from '@/domain/usecases/folders/CreateFolderUseCase'

export interface UpdateFolderRequest {
  folderId: string
  name: string
  description: string
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
}

export class UpdateFolderUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly userRepository: UserRepository

  constructor(
    folderRepository: ImageFolderRepository,
    userRepository: UserRepository,
  ) {
    this.folderRepository = folderRepository
    this.userRepository = userRepository
  }

  async execute(actor: User, request: UpdateFolderRequest): Promise<ImageFolder> {
    const folder = await this.folderRepository.getById(request.folderId)
    if (!folder) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    if (!assertUserCanEditFolder(actor, folder)) {
      throw new UnauthorizedError('No tienes permiso para editar esta carpeta')
    }

    const name = folder.routeCode
      ? folder.name
      : request.name.trim()
    const description = request.description.trim()

    if (!name) {
      throw new ValidationError('El nombre de la carpeta es obligatorio')
    }

    const assignment = await resolveAssignments(
      this.userRepository,
      actor,
      request.assignToAllTechnicians,
      request.assignedTechnicianIds,
    )

    return this.folderRepository.update(request.folderId, {
      name,
      description,
      assignToAllTechnicians: assignment.assignToAllTechnicians,
      assignedTechnicianIds: assignment.assignedTechnicianIds,
      assignedTechnicianNames: assignment.assignedTechnicianNames,
    })
  }
}
