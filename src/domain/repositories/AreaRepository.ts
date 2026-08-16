import type { Area } from '@/domain/entities/Area'

export interface AreaRepository {
  listAll(): Promise<Area[]>
  getById(id: string): Promise<Area | null>
  findByName(name: string): Promise<Area | null>
  create(input: {
    name: string
    description: string
    createdById: string
    createdByName: string
  }): Promise<Area>
  update(
    id: string,
    input: { name: string; description: string },
  ): Promise<Area>
  delete(id: string): Promise<void>
}
