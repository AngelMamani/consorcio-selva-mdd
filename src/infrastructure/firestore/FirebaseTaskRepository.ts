import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Task, TaskNotice, TaskRoute, TaskStatus } from '@/domain/entities/Task'
import {
  isValidMapCoord,
  normalizeTaskRoutes,
  primaryTaskRoute,
  TaskStatus as Status,
} from '@/domain/entities/Task'
import type {
  CreateTaskInput,
  TaskRepository,
  UpdateTaskInput,
} from '@/domain/repositories/TaskRepository'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface TaskRouteDoc {
  routeCode: string
  latitude?: number
  longitude?: number
  note?: string
  completed?: boolean
  completedById?: string
  completedByName?: string
  completedAt?: Timestamp | null
  claimedById?: string
  claimedByName?: string
  claimedAt?: Timestamp | null
  photosUploaded?: boolean
}

interface TaskNoticeDoc {
  message: string
  routeCode: string
  createdById: string
  createdByName: string
  createdAt: Timestamp
}

interface TaskDoc {
  title: string
  description: string
  status: TaskStatus
  dueDate: Timestamp | null
  areaId: string
  areaName: string
  routeCode: string
  latitude?: number
  longitude?: number
  routes?: TaskRouteDoc[]
  lastNotice?: TaskNoticeDoc | null
  assignToAllTechnicians: boolean
  assignedTechnicianIds: string[]
  assignedTechnicianNames: string[]
  createdById: string
  createdByName: string
  completedAt: Timestamp | null
  completedById: string
  completedByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

function mapRoute(data: TaskRouteDoc): TaskRoute {
  const latitude =
    typeof data.latitude === 'number' && Number.isFinite(data.latitude)
      ? data.latitude
      : null
  const longitude =
    typeof data.longitude === 'number' && Number.isFinite(data.longitude)
      ? data.longitude
      : null
  const hasCoords = isValidMapCoord(latitude, longitude)
  return {
    routeCode: String(data.routeCode ?? '').replace(/\D/g, ''),
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
    note: (data.note ?? '').trim(),
    completed: data.completed === true,
    completedById: data.completedById ?? '',
    completedByName: data.completedByName ?? '',
    completedAt: data.completedAt?.toDate() ?? null,
    claimedById: data.claimedById ?? '',
    claimedByName: data.claimedByName ?? '',
    claimedAt: data.claimedAt?.toDate() ?? null,
    photosUploaded: data.photosUploaded === true,
  }
}

function mapNotice(data: TaskNoticeDoc | null | undefined): TaskNotice | null {
  if (!data) return null
  return {
    message: data.message ?? '',
    routeCode: data.routeCode ?? '',
    createdById: data.createdById ?? '',
    createdByName: data.createdByName ?? '',
    createdAt: data.createdAt?.toDate() ?? new Date(),
  }
}

function serializeRoute(route: TaskRoute): TaskRouteDoc {
  const payload: TaskRouteDoc = {
    routeCode: route.routeCode,
    note: route.note,
    completed: route.completed,
    completedById: route.completedById,
    completedByName: route.completedByName,
    completedAt: route.completedAt ? Timestamp.fromDate(route.completedAt) : null,
    claimedById: route.claimedById,
    claimedByName: route.claimedByName,
    claimedAt: route.claimedAt ? Timestamp.fromDate(route.claimedAt) : null,
    photosUploaded: route.photosUploaded,
  }
  if (isValidMapCoord(route.latitude, route.longitude)) {
    payload.latitude = route.latitude ?? undefined
    payload.longitude = route.longitude ?? undefined
  }
  return payload
}

function serializeNotice(notice: TaskNotice): TaskNoticeDoc {
  return {
    message: notice.message,
    routeCode: notice.routeCode,
    createdById: notice.createdById,
    createdByName: notice.createdByName,
    createdAt: Timestamp.fromDate(notice.createdAt),
  }
}

function mapTask(id: string, data: TaskDoc): Task {
  const latitude =
    typeof data.latitude === 'number' && Number.isFinite(data.latitude)
      ? data.latitude
      : null
  const longitude =
    typeof data.longitude === 'number' && Number.isFinite(data.longitude)
      ? data.longitude
      : null
  const routes = normalizeTaskRoutes({
    routes: (data.routes ?? []).map(mapRoute),
    routeCode: data.routeCode,
    latitude,
    longitude,
    status: data.status,
    completedById: data.completedById,
    completedByName: data.completedByName,
    completedAt: data.completedAt?.toDate() ?? null,
  })
  const primary = primaryTaskRoute(routes)
  return {
    id,
    title: data.title,
    description: data.description ?? '',
    status: data.status ?? Status.Pendiente,
    dueDate: data.dueDate?.toDate() ?? null,
    areaId: data.areaId ?? '',
    areaName: data.areaName ?? '',
    routeCode: primary?.routeCode ?? data.routeCode ?? '',
    latitude: primary?.latitude ?? (isValidMapCoord(latitude, longitude) ? latitude : null),
    longitude:
      primary?.longitude ?? (isValidMapCoord(latitude, longitude) ? longitude : null),
    routes,
    lastNotice: mapNotice(data.lastNotice),
    assignToAllTechnicians: data.assignToAllTechnicians === true,
    assignedTechnicianIds: data.assignedTechnicianIds ?? [],
    assignedTechnicianNames: data.assignedTechnicianNames ?? [],
    createdById: data.createdById,
    createdByName: data.createdByName,
    completedAt: data.completedAt?.toDate() ?? null,
    completedById: data.completedById ?? '',
    completedByName: data.completedByName ?? '',
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

function applyCoords(
  payload: TaskDoc,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): void {
  if (isValidMapCoord(latitude, longitude)) {
    payload.latitude = latitude ?? undefined
    payload.longitude = longitude ?? undefined
    return
  }
  delete payload.latitude
  delete payload.longitude
}

function sortByUpdatedDesc(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  )
}

export class FirebaseTaskRepository implements TaskRepository {
  private readonly collectionRef = collection(firestoreDb, 'tasks')

  async getById(id: string): Promise<Task | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapTask(snapshot.id, snapshot.data() as TaskDoc)
  }

  async listAll(): Promise<Task[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, orderBy('updatedAt', 'desc')),
    )
    return snapshot.docs.map((item) =>
      mapTask(item.id, item.data() as TaskDoc),
    )
  }

  async listAccessibleForUser(userId: string): Promise<Task[]> {
    const [assignedSnap, allTechsSnap] = await Promise.all([
      getDocs(
        query(
          this.collectionRef,
          where('assignedTechnicianIds', 'array-contains', userId),
        ),
      ),
      getDocs(
        query(
          this.collectionRef,
          where('assignToAllTechnicians', '==', true),
        ),
      ),
    ])

    const byId = new Map<string, Task>()
    for (const item of [...assignedSnap.docs, ...allTechsSnap.docs]) {
      byId.set(item.id, mapTask(item.id, item.data() as TaskDoc))
    }
    return sortByUpdatedDesc([...byId.values()])
  }

  watchAll(
    onData: (tasks: Task[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      query(this.collectionRef, orderBy('updatedAt', 'desc')),
      (snapshot) => {
        onData(
          snapshot.docs.map((item) => mapTask(item.id, item.data() as TaskDoc)),
        )
      },
      (error) => onError?.(error),
    )
  }

  watchAccessibleForUser(
    userId: string,
    onData: (tasks: Task[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    let assigned: Task[] = []
    let allTechs: Task[] = []

    const emit = () => {
      const byId = new Map<string, Task>()
      for (const task of [...assigned, ...allTechs]) {
        byId.set(task.id, task)
      }
      onData(sortByUpdatedDesc([...byId.values()]))
    }

    const unsubAssigned = onSnapshot(
      query(
        this.collectionRef,
        where('assignedTechnicianIds', 'array-contains', userId),
      ),
      (snapshot) => {
        assigned = snapshot.docs.map((item) =>
          mapTask(item.id, item.data() as TaskDoc),
        )
        emit()
      },
      (error) => onError?.(error),
    )
    const unsubAll = onSnapshot(
      query(
        this.collectionRef,
        where('assignToAllTechnicians', '==', true),
      ),
      (snapshot) => {
        allTechs = snapshot.docs.map((item) =>
          mapTask(item.id, item.data() as TaskDoc),
        )
        emit()
      },
      (error) => onError?.(error),
    )

    return () => {
      unsubAssigned()
      unsubAll()
    }
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const now = Timestamp.now()
    const routes = normalizeTaskRoutes({ routes: input.routes })
    const primary = primaryTaskRoute(routes)
    const payload: TaskDoc = {
      title: input.title,
      description: input.description,
      status: input.status,
      dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
      areaId: input.areaId,
      areaName: input.areaName,
      routeCode: primary?.routeCode ?? input.routeCode,
      routes: routes.map(serializeRoute),
      assignToAllTechnicians: input.assignToAllTechnicians,
      assignedTechnicianIds: input.assignedTechnicianIds,
      assignedTechnicianNames: input.assignedTechnicianNames,
      createdById: input.createdById,
      createdByName: input.createdByName,
      completedAt: null,
      completedById: '',
      completedByName: '',
      createdAt: now,
      updatedAt: now,
    }
    applyCoords(
      payload,
      primary?.latitude ?? input.latitude,
      primary?.longitude ?? input.longitude,
    )
    const id = crypto.randomUUID()
    await setDoc(doc(this.collectionRef, id), payload)
    return mapTask(id, payload)
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const ref = doc(this.collectionRef, id)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      throw new NotFoundError('Tarea no encontrada')
    }

    const current = existing.data() as TaskDoc
    const mapped = mapTask(id, current)
    const routes = normalizeTaskRoutes({
      routes: input.routes ?? mapped.routes,
      routeCode: input.routeCode ?? mapped.routeCode,
      latitude: input.latitude === undefined ? mapped.latitude : input.latitude,
      longitude: input.longitude === undefined ? mapped.longitude : input.longitude,
      status: input.status ?? mapped.status,
      completedById: input.completedById ?? mapped.completedById,
      completedByName: input.completedByName ?? mapped.completedByName,
      completedAt:
        input.completedAt === undefined ? mapped.completedAt : input.completedAt,
    })
    const primary = primaryTaskRoute(routes)
    const lastNotice =
      input.lastNotice === undefined ? mapped.lastNotice : input.lastNotice

    const payload: TaskDoc = {
      ...current,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      status: input.status ?? current.status,
      dueDate:
        input.dueDate === undefined
          ? current.dueDate
          : input.dueDate
            ? Timestamp.fromDate(input.dueDate)
            : null,
      areaId: input.areaId ?? current.areaId,
      areaName: input.areaName ?? current.areaName,
      routeCode: primary?.routeCode ?? current.routeCode,
      routes: routes.map(serializeRoute),
      assignToAllTechnicians:
        input.assignToAllTechnicians ?? current.assignToAllTechnicians,
      assignedTechnicianIds:
        input.assignedTechnicianIds ?? current.assignedTechnicianIds,
      assignedTechnicianNames:
        input.assignedTechnicianNames ?? current.assignedTechnicianNames,
      completedAt:
        input.completedAt === undefined
          ? current.completedAt
          : input.completedAt
            ? Timestamp.fromDate(input.completedAt)
            : null,
      completedById:
        input.completedById === undefined
          ? current.completedById
          : input.completedById,
      completedByName:
        input.completedByName === undefined
          ? current.completedByName
          : input.completedByName,
      updatedAt: Timestamp.now(),
    }

    if (lastNotice) {
      payload.lastNotice = serializeNotice(lastNotice)
    } else {
      payload.lastNotice = null
    }

    applyCoords(
      payload,
      primary?.latitude ?? null,
      primary?.longitude ?? null,
    )

    await updateDoc(ref, { ...payload })
    return mapTask(id, payload)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }
}
