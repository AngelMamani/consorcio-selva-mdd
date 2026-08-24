import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Task, TaskStatus } from '@/domain/entities/Task'
import { TaskStatus as Status } from '@/domain/entities/Task'
import type {
  CreateTaskInput,
  TaskRepository,
  UpdateTaskInput,
} from '@/domain/repositories/TaskRepository'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

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

function mapTask(id: string, data: TaskDoc): Task {
  const latitude =
    typeof data.latitude === 'number' && Number.isFinite(data.latitude)
      ? data.latitude
      : null
  const longitude =
    typeof data.longitude === 'number' && Number.isFinite(data.longitude)
      ? data.longitude
      : null
  return {
    id,
    title: data.title,
    description: data.description ?? '',
    status: data.status ?? Status.Pendiente,
    dueDate: data.dueDate?.toDate() ?? null,
    areaId: data.areaId ?? '',
    areaName: data.areaName ?? '',
    routeCode: data.routeCode ?? '',
    latitude,
    longitude,
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

  async create(input: CreateTaskInput): Promise<Task> {
    const now = Timestamp.now()
    const id = crypto.randomUUID()
    const payload: TaskDoc = {
      title: input.title,
      description: input.description,
      status: input.status,
      dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
      areaId: input.areaId,
      areaName: input.areaName,
      routeCode: input.routeCode,
      latitude: input.latitude,
      longitude: input.longitude,
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
    const nextLatitude =
      input.latitude === undefined ? current.latitude : input.latitude ?? undefined
    const nextLongitude =
      input.longitude === undefined
        ? current.longitude
        : input.longitude ?? undefined

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
      routeCode: input.routeCode ?? current.routeCode,
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

    if (typeof nextLatitude === 'number') {
      payload.latitude = nextLatitude
    } else {
      delete payload.latitude
    }
    if (typeof nextLongitude === 'number') {
      payload.longitude = nextLongitude
    } else {
      delete payload.longitude
    }

    await updateDoc(ref, { ...payload })
    return mapTask(id, payload)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }
}
