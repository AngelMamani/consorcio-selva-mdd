import type { FolderImage } from '@/domain/entities/FolderImage'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'

export interface ImageFilePayload {
  fileName: string
  contentType: string
  sizeBytes: number
  data: Blob
}

export interface CreateFolderImageInput {
  folderId: string
  dateId: string
  file: ImageFilePayload
  uploadedById: string
  uploadedByName: string
  location?: GeoLocation
}

export interface FolderImageRepository {
  listByFolder(folderId: string): Promise<FolderImage[]>
  listByFolderIds(folderIds: string[]): Promise<FolderImage[]>
  listByDate(folderId: string, dateId: string): Promise<FolderImage[]>
  create(input: CreateFolderImageInput): Promise<FolderImage>
  delete(image: FolderImage): Promise<void>
  deleteAllByFolder(folderId: string): Promise<void>
  deleteAllByDate(folderId: string, dateId: string): Promise<void>
}
