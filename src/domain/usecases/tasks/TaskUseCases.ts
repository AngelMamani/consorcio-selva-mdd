import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import {
  allTaskRoutesCompleted,
  assertUserCanAccessTask,
  isValidMapCoord,
  normalizeNeighborhoodRoute,
  normalizeTaskRoutes,
  primaryTaskRoute,
  TaskStatus,
  taskTitleFromActivity,
  type Task,
  type TaskNotice,
  type TaskRoute,
} from '@/domain/entities/Task'
import { supplyHasLocation } from '@/domain/entities/Supply'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { SupplyRepository } from '@/domain/repositories/SupplyRepository'
import type { TaskRepository } from '@/domain/repositories/TaskRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import {
  isRouteCode,
  normalizeRouteCode,
} from '@/domain/value-objects/RouteCode'
import { canManageUsers, hasAssignedRole, UserRole } from '@/domain/value-objects/UserRole'

export interface TaskRouteInput {
  routeCode: string
  note?: string
}

function normalizeDescription(description: string): string {
  const trimmed = description.trim()
  if (trimmed.length > 1000) {
    throw new ValidationError('La descripción no debe superar 1000 caracteres')
  }
  return trimmed
}

function normalizeRouteNote(note: string | undefined): string {
  return (note ?? '').trim().slice(0, 200)
}

function normalizeRequiredRouteCode(value: string): string {
  const code = normalizeRouteCode(value)
  if (!isRouteCode(code)) {
    throw new ValidationError('El código de suministro no es válido')
  }
  return code
}

function parseOptionalDueDate(value: Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('La fecha límite no es válida')
  }
  return date
}

async function resolveTaskAssignments(
  userRepository: UserRepository,
  assignToAllTechnicians: boolean,
  assignedTechnicianIds: string[],
): Promise<{
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
  assignedTechnicianNames: string[]
}> {
  if (assignToAllTechnicians) {
    return {
      assignToAllTechnicians: true,
      assignedTechnicianIds: [],
      assignedTechnicianNames: [],
    }
  }

  const uniqueIds = [
    ...new Set(assignedTechnicianIds.map((id) => id.trim()).filter(Boolean)),
  ]
  if (uniqueIds.length === 0) {
    throw new ValidationError(
      'Selecciona al menos un técnico o elige “Todos los técnicos”',
    )
  }

  const technicians = (await userRepository.listTechnicians()).filter(
    (user) => hasAssignedRole(user, UserRole.Tecnico) && user.active,
  )
  const byId = new Map(technicians.map((user) => [user.id, user]))

  const ids: string[] = []
  const names: string[] = []
  for (const id of uniqueIds) {
    const tech = byId.get(id)
    if (!tech) {
      throw new ValidationError('Hay un técnico inválido o inactivo en la asignación')
    }
    ids.push(tech.id)
    names.push(tech.displayName)
  }

  return {
    assignToAllTechnicians: false,
    assignedTechnicianIds: ids,
    assignedTechnicianNames: names,
  }
}

async function resolveTaskRoutes(
  supplyRepository: SupplyRepository,
  inputs: TaskRouteInput[],
): Promise<TaskRoute[]> {
  const unique: TaskRouteInput[] = []
  const seen = new Set<string>()
  for (const item of inputs) {
    const code = normalizeRequiredRouteCode(item.routeCode)
    if (seen.has(code)) continue
    seen.add(code)
    unique.push({ routeCode: code, note: normalizeRouteNote(item.note) })
  }
  if (unique.length === 0) {
    throw new ValidationError('Agrega al menos una ruta de suministro')
  }
  if (unique.length > 40) {
    throw new ValidationError('No puedes asignar más de 40 rutas en una tarea')
  }

  const routes: TaskRoute[] = []
  for (const item of unique) {
    let supply = await supplyRepository.getByRouteCode(item.routeCode)
    if (!supply) {
      supply = await supplyRepository.ensureManual({
        routeCode: item.routeCode,
        note: item.note,
      })
    }
    routes.push({
      routeCode: item.routeCode,
      latitude: supplyHasLocation(supply) ? supply.latitude : null,
      longitude: supplyHasLocation(supply) ? supply.longitude : null,
      note: item.note || supply.note,
      completed: false,
      completedById: '',
      completedByName: '',
      completedAt: null,
      claimedById: '',
      claimedByName: '',
      claimedAt: null,
      photosUploaded: false,
    })
  }
  return routes
}

function buildNotice(
  actor: User,
  message: string,
  routeCode = '',
): TaskNotice {
  return {
    message: message.slice(0, 280),
    routeCode,
    createdById: actor.id,
    createdByName: actor.displayName,
    createdAt: new Date(),
  }
}

function markAllRoutesCompleted(routes: TaskRoute[], actor: User): TaskRoute[] {
  const now = new Date()
  return routes.map((route) =>
    route.completed
      ? route
      : {
          ...route,
          completed: true,
          completedById: actor.id,
          completedByName: actor.displayName,
          completedAt: now,
        },
  )
}

export class ListTasksUseCase {
  private readonly taskRepository: TaskRepository

  constructor(taskRepository: TaskRepository) {
    this.taskRepository = taskRepository
  }

  async execute(actor: User): Promise<Task[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    if (canManageUsers(actor.role)) {
      return this.taskRepository.listAll()
    }

    return this.taskRepository.listAccessibleForUser(actor.id)
  }

  watch(
    actor: User,
    onData: (tasks: Task[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    if (canManageUsers(actor.role)) {
      return this.taskRepository.watchAll(onData, onError)
    }
    return this.taskRepository.watchAccessibleForUser(actor.id, onData, onError)
  }
}

export class CreateTaskUseCase {
  private readonly taskRepository: TaskRepository
  private readonly areaRepository: AreaRepository
  private readonly userRepository: UserRepository
  private readonly supplyRepository: SupplyRepository

  constructor(
    taskRepository: TaskRepository,
    areaRepository: AreaRepository,
    userRepository: UserRepository,
    supplyRepository: SupplyRepository,
  ) {
    this.taskRepository = taskRepository
    this.areaRepository = areaRepository
    this.userRepository = userRepository
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    input: {
      description: string
      dueDate?: Date | null
      areaId?: string
      routes: TaskRouteInput[]
      neighborhoodRouteName?: string
      neighborhoodLatitude?: number | null
      neighborhoodLongitude?: number | null
      assignToAllTechnicians: boolean
      assignedTechnicianIds: string[]
    },
  ): Promise<Task> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo administradores pueden crear tareas')
    }

    const areaId = input.areaId?.trim() ?? ''
    if (!areaId) {
      throw new ValidationError(
        'Debes elegir la actividad donde se guardarán las fotos',
      )
    }
    const area = await this.areaRepository.getById(areaId)
    if (!area) {
      throw new ValidationError('Actividad no encontrada')
    }

    const assignment = await resolveTaskAssignments(
      this.userRepository,
      input.assignToAllTechnicians,
      input.assignedTechnicianIds,
    )
    const routes = await resolveTaskRoutes(this.supplyRepository, input.routes)
    const primary = primaryTaskRoute(routes)
    const neighborhood = normalizeNeighborhoodRoute({
      name: input.neighborhoodRouteName,
      latitude: input.neighborhoodLatitude,
      longitude: input.neighborhoodLongitude,
    })

    return this.taskRepository.create({
      title: taskTitleFromActivity(area.name),
      description: normalizeDescription(input.description),
      status: TaskStatus.Pendiente,
      dueDate: parseOptionalDueDate(input.dueDate),
      areaId,
      areaName: area.name,
      routeCode: primary?.routeCode ?? '',
      latitude: primary?.latitude ?? null,
      longitude: primary?.longitude ?? null,
      routes,
      neighborhoodRouteName: neighborhood.name,
      neighborhoodLatitude: neighborhood.latitude,
      neighborhoodLongitude: neighborhood.longitude,
      assignToAllTechnicians: assignment.assignToAllTechnicians,
      assignedTechnicianIds: assignment.assignedTechnicianIds,
      assignedTechnicianNames: assignment.assignedTechnicianNames,
      createdById: actor.id,
      createdByName: actor.displayName,
    })
  }
}

export class UpdateTaskUseCase {
  private readonly taskRepository: TaskRepository
  private readonly areaRepository: AreaRepository
  private readonly userRepository: UserRepository
  private readonly supplyRepository: SupplyRepository

  constructor(
    taskRepository: TaskRepository,
    areaRepository: AreaRepository,
    userRepository: UserRepository,
    supplyRepository: SupplyRepository,
  ) {
    this.taskRepository = taskRepository
    this.areaRepository = areaRepository
    this.userRepository = userRepository
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    taskId: string,
    input: {
      description: string
      dueDate?: Date | null
      areaId?: string
      routes: TaskRouteInput[]
      neighborhoodRouteName?: string
      neighborhoodLatitude?: number | null
      neighborhoodLongitude?: number | null
      assignToAllTechnicians: boolean
      assignedTechnicianIds: string[]
      status?: TaskStatus
    },
  ): Promise<Task> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo administradores pueden editar tareas')
    }

    const existing = await this.taskRepository.getById(taskId)
    if (!existing) {
      throw new NotFoundError('Tarea no encontrada')
    }

    const areaId = input.areaId?.trim() ?? ''
    if (!areaId) {
      throw new ValidationError(
        'Debes elegir la actividad donde se guardarán las fotos',
      )
    }
    const area = await this.areaRepository.getById(areaId)
    if (!area) {
      throw new ValidationError('Actividad no encontrada')
    }

    const assignment = await resolveTaskAssignments(
      this.userRepository,
      input.assignToAllTechnicians,
      input.assignedTechnicianIds,
    )
    const nextRoutes = await resolveTaskRoutes(this.supplyRepository, input.routes)
    const previousByCode = new Map(
      normalizeTaskRoutes(existing).map((route) => [route.routeCode, route]),
    )
    const routes = nextRoutes.map((route) => {
      const previous = previousByCode.get(route.routeCode)
      if (!previous) return route
      return {
        ...route,
        completed: previous.completed,
        completedById: previous.completedById,
        completedByName: previous.completedByName,
        completedAt: previous.completedAt,
        latitude: route.latitude ?? previous.latitude,
        longitude: route.longitude ?? previous.longitude,
      }
    })
    const primary = primaryTaskRoute(routes)
    const neighborhood = normalizeNeighborhoodRoute({
      name: input.neighborhoodRouteName,
      latitude: input.neighborhoodLatitude,
      longitude: input.neighborhoodLongitude,
    })

    const nextStatus = input.status ?? existing.status
    const completing =
      nextStatus === TaskStatus.Completada &&
      existing.status !== TaskStatus.Completada
    const reopening =
      nextStatus !== TaskStatus.Completada &&
      existing.status === TaskStatus.Completada
    const finalRoutes = completing
      ? markAllRoutesCompleted(routes, actor)
      : reopening
        ? routes.map((route) => ({
            ...route,
            completed: false,
            completedById: '',
            completedByName: '',
            completedAt: null,
          }))
        : routes

    return this.taskRepository.update(taskId, {
      title: taskTitleFromActivity(area.name),
      description: normalizeDescription(input.description),
      dueDate: parseOptionalDueDate(input.dueDate),
      areaId,
      areaName: area.name,
      routeCode: primary?.routeCode ?? '',
      latitude: primary?.latitude ?? null,
      longitude: primary?.longitude ?? null,
      routes: finalRoutes,
      neighborhoodRouteName: neighborhood.name,
      neighborhoodLatitude: neighborhood.latitude,
      neighborhoodLongitude: neighborhood.longitude,
      assignToAllTechnicians: assignment.assignToAllTechnicians,
      assignedTechnicianIds: assignment.assignedTechnicianIds,
      assignedTechnicianNames: assignment.assignedTechnicianNames,
      status: nextStatus,
      completedAt: completing
        ? new Date()
        : reopening
          ? null
          : existing.completedAt,
      completedById: completing
        ? actor.id
        : reopening
          ? ''
          : existing.completedById,
      completedByName: completing
        ? actor.displayName
        : reopening
          ? ''
          : existing.completedByName,
    })
  }
}

export class CompleteTaskUseCase {
  private readonly taskRepository: TaskRepository

  constructor(taskRepository: TaskRepository) {
    this.taskRepository = taskRepository
  }

  async execute(actor: User, taskId: string): Promise<Task> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const existing = await this.taskRepository.getById(taskId)
    if (!existing) {
      throw new NotFoundError('Tarea no encontrada')
    }

    if (
      !assertUserCanAccessTask(actor, existing, canManageUsers(actor.role))
    ) {
      throw new UnauthorizedError('No tienes acceso a esta tarea')
    }

    if (existing.status === TaskStatus.Completada) {
      return existing
    }

    const routes = markAllRoutesCompleted(normalizeTaskRoutes(existing), actor)
    return this.taskRepository.update(taskId, {
      status: TaskStatus.Completada,
      routes,
      lastNotice: buildNotice(
        actor,
        `${actor.displayName} completó la tarea ${existing.title}`,
      ),
      completedAt: new Date(),
      completedById: actor.id,
      completedByName: actor.displayName,
    })
  }
}

export class CompleteTaskRouteUseCase {
  private readonly taskRepository: TaskRepository

  constructor(taskRepository: TaskRepository) {
    this.taskRepository = taskRepository
  }

  async execute(actor: User, taskId: string, routeCode: string): Promise<Task> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const existing = await this.taskRepository.getById(taskId)
    if (!existing) {
      throw new NotFoundError('Tarea no encontrada')
    }
    if (
      !assertUserCanAccessTask(actor, existing, canManageUsers(actor.role))
    ) {
      throw new UnauthorizedError('No tienes acceso a esta tarea')
    }

    const code = normalizeRequiredRouteCode(routeCode)
    const routes = normalizeTaskRoutes(existing)
    const index = routes.findIndex((route) => route.routeCode === code)
    if (index < 0) {
      throw new ValidationError('Esa ruta no está en la tarea')
    }
    const current = routes[index]
    if (!current.completed) {
      if (!current.claimedById) {
        throw new ValidationError(
          'El técnico debe agarrar el punto antes de completarlo',
        )
      }
      if (!current.photosUploaded) {
        throw new ValidationError(
          'El técnico debe mandar fotos antes de completar',
        )
      }
      routes[index] = {
        ...current,
        completed: true,
        completedById: actor.id,
        completedByName: actor.displayName,
        completedAt: new Date(),
      }
    }

    const done = allTaskRoutesCompleted(routes)
    return this.taskRepository.update(taskId, {
      routes,
      status: done
        ? TaskStatus.Completada
        : existing.status === TaskStatus.Pendiente
          ? TaskStatus.EnProgreso
          : existing.status,
      lastNotice: buildNotice(
        actor,
        `${actor.displayName} completó el suministro ${code}`,
        code,
      ),
      completedAt: done ? new Date() : existing.completedAt,
      completedById: done ? actor.id : existing.completedById,
      completedByName: done ? actor.displayName : existing.completedByName,
    })
  }
}

export class SaveTaskRouteLocationUseCase {
  private readonly taskRepository: TaskRepository
  private readonly supplyRepository: SupplyRepository

  constructor(
    taskRepository: TaskRepository,
    supplyRepository: SupplyRepository,
  ) {
    this.taskRepository = taskRepository
    this.supplyRepository = supplyRepository
  }

  async execute(
    actor: User,
    taskId: string,
    routeCode: string,
    latitude: number,
    longitude: number,
  ): Promise<Task> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }
    if (!isValidMapCoord(latitude, longitude)) {
      throw new ValidationError('La ubicación GPS no es válida')
    }

    const existing = await this.taskRepository.getById(taskId)
    if (!existing) {
      throw new NotFoundError('Tarea no encontrada')
    }
    if (
      !assertUserCanAccessTask(actor, existing, canManageUsers(actor.role))
    ) {
      throw new UnauthorizedError('No tienes acceso a esta tarea')
    }

    const code = normalizeRequiredRouteCode(routeCode)
    const routes = normalizeTaskRoutes(existing)
    const index = routes.findIndex((route) => route.routeCode === code)
    if (index < 0) {
      throw new ValidationError('Esa ruta no está en la tarea')
    }
    if (isValidMapCoord(routes[index].latitude, routes[index].longitude)) {
      return existing
    }

    try {
      await this.supplyRepository.setLocation(code, latitude, longitude)
    } catch {
      // Si el catálogo no existe o ya tenía GPS, igual guardamos el punto en la tarea.
    }

    routes[index] = {
      ...routes[index],
      latitude,
      longitude,
    }
    const primary = primaryTaskRoute(routes)
    return this.taskRepository.update(taskId, {
      routes,
      latitude: primary?.latitude ?? null,
      longitude: primary?.longitude ?? null,
      lastNotice: buildNotice(
        actor,
        `${actor.displayName} guardó la ubicación del suministro ${code}`,
        code,
      ),
    })
  }
}

export class StartTaskUseCase {
  private readonly taskRepository: TaskRepository

  constructor(taskRepository: TaskRepository) {
    this.taskRepository = taskRepository
  }

  async execute(actor: User, taskId: string): Promise<Task> {
    if (!actor.active) {
      throw new UnauthorizedError('Usuario inactivo')
    }

    const existing = await this.taskRepository.getById(taskId)
    if (!existing) {
      throw new NotFoundError('Tarea no encontrada')
    }

    if (
      !assertUserCanAccessTask(actor, existing, canManageUsers(actor.role))
    ) {
      throw new UnauthorizedError('No tienes acceso a esta tarea')
    }

    if (existing.status === TaskStatus.Completada) {
      throw new ValidationError('La tarea ya está completada')
    }

    if (existing.status === TaskStatus.EnProgreso) {
      return existing
    }

    return this.taskRepository.update(taskId, {
      status: TaskStatus.EnProgreso,
      routes: normalizeTaskRoutes(existing),
      completedAt: null,
      completedById: '',
      completedByName: '',
    })
  }
}

export class DeleteTaskUseCase {
  private readonly taskRepository: TaskRepository

  constructor(taskRepository: TaskRepository) {
    this.taskRepository = taskRepository
  }

  async execute(actor: User, taskId: string): Promise<void> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError('Solo administradores pueden eliminar tareas')
    }

    const existing = await this.taskRepository.getById(taskId)
    if (!existing) {
      throw new NotFoundError('Tarea no encontrada')
    }

    await this.taskRepository.delete(taskId)
  }
}
