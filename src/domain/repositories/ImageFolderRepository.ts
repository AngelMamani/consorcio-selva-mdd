import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'

export interface CreateImageFolderInput {
  id?: string
  areaId: string
  areaName: string
  name: string
  description: string
  ownerId: string
  ownerName: string
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
  assignedTechnicianNames: string[]
  routeCode?: string
  location?: GeoLocation
}

export interface UpdateImageFolderInput {
  name?: string
  description?: string
  assignToAllTechnicians?: boolean
  assignedTechnicianIds?: string[]
  assignedTechnicianNames?: string[]
}

export interface ImageFolderRepository {
  getById(id: string): Promise<ImageFolder | null>
  listAll(): Promise<ImageFolder[]>
  listByOwner(ownerId: string): Promise<ImageFolder[]>
  /** Carpetas propias, asignadas o abiertas a todos los técnicos. */
  listAccessibleForUser(userId: string): Promise<ImageFolder[]>
  listByArea(areaId: string): Promise<ImageFolder[]>
  listWithoutArea(): Promise<ImageFolder[]>
  create(input: CreateImageFolderInput): Promise<ImageFolder>
  update(id: string, input: UpdateImageFolderInput): Promise<ImageFolder>
  assignArea(
    id: string,
    input: { areaId: string; areaName: string },
  ): Promise<void>
  incrementImageCount(folderId: string, delta: number): Promise<void>
  delete(id: string): Promise<void>
}
