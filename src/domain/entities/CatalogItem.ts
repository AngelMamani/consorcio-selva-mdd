export interface CatalogItem {
  id: string
  name: string
  createdById: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

export function catalogNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}
