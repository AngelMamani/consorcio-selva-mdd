import type { CatalogItem } from '@/domain/entities/CatalogItem'

export interface CatalogRepository {
  listAll(): Promise<CatalogItem[]>
  getById(id: string): Promise<CatalogItem | null>
  findByName(name: string): Promise<CatalogItem | null>
  create(input: {
    name: string
    createdById: string
    createdByName: string
  }): Promise<CatalogItem>
  update(id: string, input: { name: string }): Promise<CatalogItem>
  delete(id: string): Promise<void>
}
