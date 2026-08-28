import type {
  Task,
  TaskNotice,
  TaskRoute,
  TaskStatus,
} from '@/domain/entities/Task'

export interface CreateTaskInput {
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
  routes?: TaskRoute[]
  neighborhoodRouteName?: string
  neighborhoodLatitude?: number | null
  neighborhoodLongitude?: number | null
  lastNotice?: TaskNotice | null
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
  watchAll(
    onData: (tasks: Task[]) => void,
    onError?: (error: Error) => void,
  ): () => void
  watchAccessibleForUser(
    userId: string,
    onData: (tasks: Task[]) => void,
    onError?: (error: Error) => void,
  ): () => void
  create(input: CreateTaskInput): Promise<Task>
  update(id: string, input: UpdateTaskInput): Promise<Task>
  delete(id: string): Promise<void>
}
