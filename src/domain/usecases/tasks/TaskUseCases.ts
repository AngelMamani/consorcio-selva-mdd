import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import {
  assertUserCanAccessTask,
  TaskStatus,
  type Task,
} from '@/domain/entities/Task'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import type { SupplyRepository } from '@/domain/repositories/SupplyRepository'
import type { TaskRepository } from '@/domain/repositories/TaskRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'
import { resolveAssignments } from '@/domain/usecases/folders/CreateFolderUseCase'
import {
  isRouteCode,
  normalizeRouteCode,
} from '@/domain/value-objects/RouteCode'
import { canManageUsers } from '@/domain/value-objects/UserRole'

function normalizeTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) {
    throw new ValidationError('El título de la tarea es obligatorio')
  }
  if (trimmed.length > 160) {
    throw new ValidationError('El título no debe superar 160 caracteres')
  }
  return trimmed
}

function normalizeDescription(description: string): string {
  const trimmed = description.trim()
  if (trimmed.length > 1000) {
    throw new ValidationError('La descripción no debe superar 1000 caracteres')
  }
  return trimmed
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
      title: string
      description: string
      dueDate?: Date | null
      areaId?: string
      routeCode?: string
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
    const areaName = area.name

    const assignment = await resolveAssignments(
      this.userRepository,
      actor,
      input.assignToAllTechnicians,
      input.assignedTechnicianIds,
    )

    const code = normalizeRequiredRouteCode(input.routeCode ?? '')
    const supply = await this.supplyRepository.getByRouteCode(code)
    if (!supply) {
      throw new ValidationError(
        'No hay suministro con ese código. Revisa el catálogo en Estaciones.',
      )
    }

    return this.taskRepository.create({
      title: normalizeTitle(input.title),
      description: normalizeDescription(input.description),
      status: TaskStatus.Pendiente,
      dueDate: parseOptionalDueDate(input.dueDate),
      areaId,
      areaName,
      routeCode: code,
      latitude: supply.latitude,
      longitude: supply.longitude,
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
      title: string
      description: string
      dueDate?: Date | null
      areaId?: string
      routeCode?: string
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
    const areaName = area.name

    const assignment = await resolveAssignments(
      this.userRepository,
      actor,
      input.assignToAllTechnicians,
      input.assignedTechnicianIds,
    )

    const code = normalizeRequiredRouteCode(input.routeCode ?? '')
    const supply = await this.supplyRepository.getByRouteCode(code)
    if (!supply) {
      throw new ValidationError(
        'No hay suministro con ese código. Revisa el catálogo en Estaciones.',
      )
    }

    const nextStatus = input.status ?? existing.status
    const completing =
      nextStatus === TaskStatus.Completada &&
      existing.status !== TaskStatus.Completada
    const reopening =
      nextStatus !== TaskStatus.Completada &&
      existing.status === TaskStatus.Completada

    return this.taskRepository.update(taskId, {
      title: normalizeTitle(input.title),
      description: normalizeDescription(input.description),
      dueDate: parseOptionalDueDate(input.dueDate),
      areaId,
      areaName,
      routeCode: code,
      latitude: supply.latitude,
      longitude: supply.longitude,
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

    return this.taskRepository.update(taskId, {
      status: TaskStatus.Completada,
      completedAt: new Date(),
      completedById: actor.id,
      completedByName: actor.displayName,
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
