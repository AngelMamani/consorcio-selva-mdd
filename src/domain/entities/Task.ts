import {
  isRouteCode,
  normalizeRouteCode,
} from '@/domain/value-objects/RouteCode'

export const TaskStatus = {
  Pendiente: 'PENDIENTE',
  EnProgreso: 'EN_PROGRESO',
  Completada: 'COMPLETADA',
} as const

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]

export interface TaskRoute {
  routeCode: string
  latitude: number | null
  longitude: number | null
  note: string
  completed: boolean
  completedById: string
  completedByName: string
  completedAt: Date | null
  claimedById: string
  claimedByName: string
  claimedAt: Date | null
  photosUploaded: boolean
}

export interface TaskNotice {
  message: string
  routeCode: string
  createdById: string
  createdByName: string
  createdAt: Date
}

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
  routes: TaskRoute[]
  neighborhoodRouteName: string
  neighborhoodLatitude: number | null
  neighborhoodLongitude: number | null
  lastNotice: TaskNotice | null
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

export function taskTitleFromActivity(areaName: string): string {
  const name = areaName.trim()
  if (!name) return 'Tarea'
  return name.slice(0, 160)
}

export function isValidMapCoord(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0)
  )
}

export function normalizeNeighborhoodRouteCode(value: string | undefined): string {
  const code = normalizeRouteCode(value ?? '')
  if (!code) return ''
  return isRouteCode(code) ? code : ''
}

export function taskHasNeighborhoodRoute(
  task: Pick<Task, 'neighborhoodRouteName'>,
): boolean {
  return Boolean(normalizeNeighborhoodRouteCode(task.neighborhoodRouteName))
}

export function taskHasNeighborhoodMapPoint(
  task: Pick<Task, 'neighborhoodLatitude' | 'neighborhoodLongitude'>,
): boolean {
  return isValidMapCoord(task.neighborhoodLatitude, task.neighborhoodLongitude)
}

export function neighborhoodMapsUrl(task: Pick<
  Task,
  'neighborhoodLatitude' | 'neighborhoodLongitude'
>): string | null {
  if (!taskHasNeighborhoodMapPoint(task)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${task.neighborhoodLatitude},${task.neighborhoodLongitude}&travelmode=driving`
}

export function taskRouteHasMapPoint(
  route: Pick<TaskRoute, 'latitude' | 'longitude'>,
): boolean {
  return isValidMapCoord(route.latitude, route.longitude)
}

export function taskHasMapPoint(
  task: Pick<Task, 'latitude' | 'longitude' | 'routes'>,
): boolean {
  if (taskRouteHasMapPoint(task)) return true
  return (task.routes ?? []).some((route) => taskRouteHasMapPoint(route))
}

export function normalizeTaskRoutes(input: {
  routes?: TaskRoute[] | null
  routeCode?: string
  latitude?: number | null
  longitude?: number | null
  status?: TaskStatus
  completedById?: string
  completedByName?: string
  completedAt?: Date | null
}): TaskRoute[] {
  const fromList = (input.routes ?? []).filter((route) =>
    Boolean(route.routeCode?.trim()),
  )
  if (fromList.length > 0) {
    const seen = new Set<string>()
    const unique: TaskRoute[] = []
    for (const route of fromList) {
      const code = route.routeCode.replace(/\D/g, '')
      if (!code || seen.has(code)) continue
      seen.add(code)
      unique.push({
        routeCode: code,
        latitude: isValidMapCoord(route.latitude, route.longitude)
          ? route.latitude
          : null,
        longitude: isValidMapCoord(route.latitude, route.longitude)
          ? route.longitude
          : null,
        note: (route.note ?? '').trim().slice(0, 200),
        completed: route.completed === true,
        completedById: route.completedById ?? '',
        completedByName: route.completedByName ?? '',
        completedAt: route.completedAt ?? null,
        claimedById: route.claimedById ?? '',
        claimedByName: route.claimedByName ?? '',
        claimedAt: route.claimedAt ?? null,
        photosUploaded: route.photosUploaded === true,
      })
    }
    return unique
  }

  const code = (input.routeCode ?? '').replace(/\D/g, '')
  if (!code) return []
  const completed = input.status === TaskStatus.Completada
  return [
    {
      routeCode: code,
      latitude: isValidMapCoord(input.latitude, input.longitude)
        ? input.latitude ?? null
        : null,
      longitude: isValidMapCoord(input.latitude, input.longitude)
        ? input.longitude ?? null
        : null,
      note: '',
      completed,
      completedById: completed ? (input.completedById ?? '') : '',
      completedByName: completed ? (input.completedByName ?? '') : '',
      completedAt: completed ? (input.completedAt ?? null) : null,
      claimedById: '',
      claimedByName: '',
      claimedAt: null,
      photosUploaded: false,
    },
  ]
}

export function primaryTaskRoute(routes: TaskRoute[]): TaskRoute | null {
  return routes[0] ?? null
}

export function taskRoutesLabel(routes: TaskRoute[]): string {
  if (routes.length === 0) return 'Sin rutas'
  if (routes.length === 1) return `Suministro ${routes[0].routeCode}`
  return `${routes.length} rutas`
}

export function allTaskRoutesCompleted(routes: TaskRoute[]): boolean {
  return routes.length > 0 && routes.every((route) => route.completed)
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
