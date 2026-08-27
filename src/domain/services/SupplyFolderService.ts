import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type { Supply } from '@/domain/entities/Supply'
import { supplyHasLocation } from '@/domain/entities/Supply'

export const VIRTUAL_SUPPLY_FOLDER_PREFIX = 'virtual:'

export function supplyFolderDocId(areaId: string, routeCode: string): string {
  return `sf_${areaId}_${routeCode}`
}

const SUPPLY_FOLDER_ID_RE =
  /^sf_([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})_(\d{7,12})$/

export function parseSupplyFolderDocId(
  id: string,
): { areaId: string; routeCode: string } | null {
  const match = SUPPLY_FOLDER_ID_RE.exec(id)
  if (!match) return null
  return { areaId: match[1], routeCode: match[2] }
}

export function virtualSupplyFolderId(routeCode: string): string {
  return `${VIRTUAL_SUPPLY_FOLDER_PREFIX}${routeCode}`
}

export function isVirtualSupplyFolderId(id: string): boolean {
  return id.startsWith(VIRTUAL_SUPPLY_FOLDER_PREFIX)
}

export function isSupplyFolder(
  folder: Pick<ImageFolder, 'routeCode'>,
): boolean {
  return Boolean(folder.routeCode)
}

export function folderFromSupply(input: {
  areaId: string
  areaName: string
  supply: Supply
  existing?: ImageFolder
}): ImageFolder {
  if (input.existing) return input.existing
  const now = input.supply.updatedAt
  return {
    id: supplyFolderDocId(input.areaId, input.supply.routeCode),
    areaId: input.areaId,
    areaName: input.areaName,
    name: input.supply.routeCode,
    description: 'Suministro',
    ownerId: '',
    ownerName: '',
    assignToAllTechnicians: true,
    assignedTechnicianIds: [],
    assignedTechnicianNames: [],
    imageCount: 0,
    routeCode: input.supply.routeCode,
    location: supplyHasLocation(input.supply)
      ? {
          latitude: input.supply.latitude,
          longitude: input.supply.longitude,
        }
      : undefined,
    createdAt: now,
    updatedAt: now,
  }
}
