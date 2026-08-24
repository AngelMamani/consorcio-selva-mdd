import type { Task, TaskStatus } from '@/domain/entities/Task'

export interface CreateTaskInput {
  title: string
  description: string
  status: TaskStatus
  dueDate: Date | null
  areaId: string
  areaName: string
  routeCode: string
  latitude: number
  longitude: number
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
  assignedTechnicianNames: string[]
  createdById: string
  createdByName: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  dueDate?: Date | null
  areaId?: string
  areaName?: string
  routeCode?: string
  latitude?: number | null
  longitude?: number | null
  assignToAllTechnicians?: boolean
  assignedTechnicianIds?: string[]
  assignedTechnicianNames?: string[]
  completedAt?: Date | null
  completedById?: string
  completedByName?: string
}

export interface TaskRepository {
  getById(id: string): Promise<Task | null>
  listAll(): Promise<Task[]>
  listAccessibleForUser(userId: string): Promise<Task[]>
  create(input: CreateTaskInput): Promise<Task>
  update(id: string, input: UpdateTaskInput): Promise<Task>
  delete(id: string): Promise<void>
}
