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
} from 'firebase/firestore'
import type { Area } from '@/domain/entities/Area'
import type { AreaRepository } from '@/domain/repositories/AreaRepository'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'
import {
  defaultReportCode,
  inferAreaAssignmentMode,
  activityNameKey,
  type AreaAssignmentMode,
} from '@/domain/value-objects/AreaAssignmentMode'

interface AreaDoc {
  name: string
  description: string
  assignmentMode?: string
  reportCode?: string
  createdById: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

function mapArea(id: string, data: AreaDoc): Area {
  const assignmentMode = inferAreaAssignmentMode(data.name, data.assignmentMode)
  return {
    id,
    name: data.name,
    description: data.description ?? '',
    assignmentMode,
    reportCode:
      (data.reportCode ?? '').trim().toUpperCase() ||
      defaultReportCode(assignmentMode, data.name),
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

export class FirebaseAreaRepository implements AreaRepository {
  private readonly collectionRef = collection(firestoreDb, 'areas')

  async listAll(): Promise<Area[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, orderBy('name', 'asc')),
    )
    return snapshot.docs.map((item) =>
      mapArea(item.id, item.data() as AreaDoc),
    )
  }

  async getById(id: string): Promise<Area | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapArea(snapshot.id, snapshot.data() as AreaDoc)
  }

  async findByName(name: string): Promise<Area | null> {
    const key = activityNameKey(name)
    const all = await this.listAll()
    return all.find((area) => activityNameKey(area.name) === key) ?? null
  }

  async create(input: {
    name: string
    description: string
    assignmentMode: AreaAssignmentMode
    reportCode: string
    createdById: string
    createdByName: string
  }): Promise<Area> {
    const now = Timestamp.now()
    const id = crypto.randomUUID()
    const payload: AreaDoc = {
      name: input.name,
      description: input.description,
      assignmentMode: input.assignmentMode,
      reportCode: input.reportCode,
      createdById: input.createdById,
      createdByName: input.createdByName,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(doc(this.collectionRef, id), payload)
    return mapArea(id, payload)
  }

  async update(
    id: string,
    input: {
      name: string
      description: string
      assignmentMode: AreaAssignmentMode
      reportCode: string
    },
  ): Promise<Area> {
    const refDoc = doc(this.collectionRef, id)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Área no encontrada')
    }
    const current = snapshot.data() as AreaDoc
    const payload: AreaDoc = {
      ...current,
      name: input.name,
      description: input.description,
      assignmentMode: input.assignmentMode,
      reportCode: input.reportCode,
      updatedAt: Timestamp.now(),
    }
    await setDoc(refDoc, payload)
    return mapArea(id, payload)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }
}
