export const TaskStatus = {
  Pendiente: 'PENDIENTE',
  EnProgreso: 'EN_PROGRESO',
  Completada: 'COMPLETADA',
} as const

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  dueDate: Date | null
  areaId: string
  areaName: string
  routeCode: string
  latitude: number | null
  longitude: number | null
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
  assignedTechnicianNames: string[]
  createdById: string
  createdByName: string
  completedAt: Date | null
  completedById: string
  completedByName: string
  createdAt: Date
  updatedAt: Date
}

export function taskHasMapPoint(
  task: Pick<Task, 'latitude' | 'longitude'>,
): boolean {
  return (
    typeof task.latitude === 'number' &&
    typeof task.longitude === 'number' &&
    Number.isFinite(task.latitude) &&
    Number.isFinite(task.longitude)
  )
}

export function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.EnProgreso:
      return 'En progreso'
    case TaskStatus.Completada:
      return 'Completada'
    case TaskStatus.Pendiente:
    default:
      return 'Pendiente'
  }
}

export function formatTaskAssignees(task: Task): string {
  if (task.assignToAllTechnicians) return 'Todos los técnicos'
  const names = task.assignedTechnicianNames ?? []
  if (names.length === 0) return 'Sin asignar'
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(', ')
  return `${names[0]} +${names.length - 1}`
}

export function assertUserCanAccessTask(
  user: { id: string; role: string },
  task: Pick<
    Task,
    'assignToAllTechnicians' | 'assignedTechnicianIds' | 'createdById'
  >,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true
  if (task.createdById === user.id) return true
  if (task.assignToAllTechnicians) return true
  return (task.assignedTechnicianIds ?? []).includes(user.id)
}
