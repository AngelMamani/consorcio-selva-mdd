import type { GeoLocation } from '@/domain/value-objects/GeoLocation'

export interface FolderImage {
  id: string
  folderId: string
  dateId: string
  fileName: string
  storagePath: string
  downloadUrl: string
  contentType: string
  sizeBytes: number
  uploadedById: string
  uploadedByName: string
  location?: GeoLocation
  createdAt: Date
}
