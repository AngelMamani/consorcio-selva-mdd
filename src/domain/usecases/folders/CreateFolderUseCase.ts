import type { ImageFolderRepository } from '@/domain/repositories/ImageFolderRepository'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { User } from '@/domain/entities/User'
import { UserRole } from '@/domain/value-objects/UserRole'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'

export interface CreateFolderRequest {
  areaId: string
  name: string
  description: string
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
}

export class CreateFolderUseCase {
  private readonly folderRepository: ImageFolderRepository
  private readonly areaRepository: AreaRepository
  private readonly userRepository: UserRepository

  constructor(
    folderRepository: ImageFolderRepository,
    areaRepository: AreaRepository,
    userRepository: UserRepository,
  ) {
    this.folderRepository = folderRepository
    this.areaRepository = areaRepository
    this.userRepository = userRepository
  }

  async execute(actor: User, request: CreateFolderRequest): Promise<ImageFolder> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    const name = request.name.trim()
    const description = request.description.trim()
    const areaId = request.areaId.trim()

    if (!areaId) {
      throw new ValidationError('Debes indicar el área')
    }
    if (!name) {
      throw new ValidationError('El nombre de la carpeta es obligatorio')
    }

    const area = await this.areaRepository.getById(areaId)
    if (!area) {
      throw new ValidationError('Área no encontrada')
    }

    const assignment = await resolveAssignments(
      this.userRepository,
      actor,
      request.assignToAllTechnicians,
      request.assignedTechnicianIds,
    )

    return this.folderRepository.create({
      areaId: area.id,
      areaName: area.name,
      name,
      description,
      ownerId: actor.id,
      ownerName: actor.displayName,
      assignToAllTechnicians: assignment.assignToAllTechnicians,
      assignedTechnicianIds: assignment.assignedTechnicianIds,
      assignedTechnicianNames: assignment.assignedTechnicianNames,
    })
  }
}

export async function resolveAssignments(
  userRepository: UserRepository,
  actor: User,
  assignToAllTechnicians: boolean,
  assignedTechnicianIds: string[],
): Promise<{
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
  assignedTechnicianNames: string[]
}> {
  if (assignToAllTechnicians) {
    return {
      assignToAllTechnicians: true,
      assignedTechnicianIds: [],
      assignedTechnicianNames: [],
    }
  }

  const uniqueIds = [...new Set(assignedTechnicianIds.map((id) => id.trim()).filter(Boolean))]

  // El creador técnico siempre queda incluido.
  if (actor.role === UserRole.Tecnico && !uniqueIds.includes(actor.id)) {
    uniqueIds.push(actor.id)
  }

  if (uniqueIds.length === 0) {
    throw new ValidationError(
      'Selecciona al menos un técnico o elige “Todos los técnicos”',
    )
  }

  const technicians = (await userRepository.listTechnicians()).filter(
    (user) => user.role === UserRole.Tecnico && user.active,
  )
  const byId = new Map(technicians.map((user) => [user.id, user]))

  const ids: string[] = []
  const names: string[] = []
  for (const id of uniqueIds) {
    const tech = byId.get(id)
    if (!tech) {
      throw new ValidationError('Hay un técnico inválido o inactivo en la asignación')
    }
    ids.push(tech.id)
    names.push(tech.displayName)
  }

  return {
    assignToAllTechnicians: false,
    assignedTechnicianIds: ids,
    assignedTechnicianNames: names,
  }
}
