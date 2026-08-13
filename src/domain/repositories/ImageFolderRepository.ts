import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'

export interface CreateImageFolderInput {
  name: string
  description: string
  ownerId: string
  ownerName: string
  location?: GeoLocation
}

export interface UpdateImageFolderInput {
  name?: string
  description?: string
}

export interface ImageFolderRepository {
  getById(id: string): Promise<ImageFolder | null>
  listAll(): Promise<ImageFolder[]>
  listByOwner(ownerId: string): Promise<ImageFolder[]>
  create(input: CreateImageFolderInput): Promise<ImageFolder>
  update(id: string, input: UpdateImageFolderInput): Promise<ImageFolder>
  incrementImageCount(folderId: string, delta: number): Promise<void>
  delete(id: string): Promise<void>
}
