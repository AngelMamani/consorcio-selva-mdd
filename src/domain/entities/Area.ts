import {
  AreaAssignmentMode,
  defaultReportCode,
  inferAreaAssignmentMode,
  looksLikeMeterChangeActivity,
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

export function isWorkOrderArea(
  area: Pick<Area, 'name' | 'assignmentMode'>,
): boolean {
  return (
    inferAreaAssignmentMode(area.name, area.assignmentMode) ===
    AreaAssignmentMode.WorkOrders
  )
}

export function areaReportCode(
  area: Pick<Area, 'name' | 'assignmentMode' | 'reportCode'>,
): string {
  const mode = inferAreaAssignmentMode(area.name, area.assignmentMode)
  return area.reportCode.trim() || defaultReportCode(mode, area.name)
}

/** Actividad de cambio de medidor (órdenes tipo LISTA_CM). */
export function isMeterChangeArea(
  area: Pick<Area, 'name' | 'assignmentMode' | 'reportCode'>,
): boolean {
  if (!isWorkOrderArea(area)) return false
  if (looksLikeMeterChangeActivity(area.name)) return true
  return areaReportCode(area) === 'CM'
}

/** Actividad de instalaciones nuevas (órdenes IN). */
export function isInstallationArea(
  area: Pick<Area, 'name' | 'assignmentMode' | 'reportCode'>,
): boolean {
  return isWorkOrderArea(area) && !isMeterChangeArea(area)
}
