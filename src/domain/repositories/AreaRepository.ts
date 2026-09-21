import type { Area } from '@/domain/entities/Area'
import type { AreaAssignmentMode } from '@/domain/value-objects/AreaAssignmentMode'

export interface AreaRepository {
  listAll(): Promise<Area[]>
  getById(id: string): Promise<Area | null>
  findByName(name: string): Promise<Area | null>
  create(input: {
    name: string
    description: string
    assignmentMode: AreaAssignmentMode
    reportCode: string
    scanSplitEnabled?: boolean
    createdById: string
    createdByName: string
  }): Promise<Area>
  update(
    id: string,
    input: {
      name: string
      description: string
      assignmentMode: AreaAssignmentMode
      reportCode: string
      scanSplitEnabled?: boolean
    },
  ): Promise<Area>
  delete(id: string): Promise<void>
}
