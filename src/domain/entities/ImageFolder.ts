import type { GeoLocation } from '@/domain/value-objects/GeoLocation'

export interface ImageFolder {
  id: string
  name: string
  description: string
  ownerId: string
  ownerName: string
  imageCount: number
  location?: GeoLocation
  createdAt: Date
  updatedAt: Date
}
