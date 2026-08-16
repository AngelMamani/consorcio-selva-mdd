import type { GeoLocation } from '@/domain/value-objects/GeoLocation'

export interface ImageFolder {
  id: string
  areaId: string
  areaName: string
  name: string
  description: string
  ownerId: string
  ownerName: string
  /** Si true, todos los técnicos activos pueden ver/usar la carpeta. */
  assignToAllTechnicians: boolean
  /** Técnicos asignados (ignorado si assignToAllTechnicians). */
  assignedTechnicianIds: string[]
  assignedTechnicianNames: string[]
  imageCount: number
  location?: GeoLocation
  createdAt: Date
  updatedAt: Date
}
