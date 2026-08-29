import {
  AreaAssignmentMode,
  defaultReportCode,
  inferAreaAssignmentMode,
  type AreaAssignmentMode as AssignmentMode,
} from '@/domain/value-objects/AreaAssignmentMode'

export interface Area {
  id: string
  name: string
  description: string
  assignmentMode: AssignmentMode
  reportCode: string
  createdById: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

export function isWorkOrderArea(area: Pick<Area, 'name' | 'assignmentMode'>): boolean {
  return inferAreaAssignmentMode(area.name, area.assignmentMode) ===
    AreaAssignmentMode.WorkOrders
}

export function areaReportCode(area: Pick<Area, 'name' | 'assignmentMode' | 'reportCode'>): string {
  const mode = inferAreaAssignmentMode(area.name, area.assignmentMode)
  return area.reportCode.trim() || defaultReportCode(mode, area.name)
}
