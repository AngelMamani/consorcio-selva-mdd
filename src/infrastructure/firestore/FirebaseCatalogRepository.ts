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
import { catalogNameKey, type CatalogItem } from '@/domain/entities/CatalogItem'
import type { CatalogRepository } from '@/domain/repositories/CatalogRepository'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface CatalogDoc {
  name: string
  nameKey: string
  createdById: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

function mapItem(id: string, data: CatalogDoc): CatalogItem {
  return {
    id,
    name: data.name,
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

export class FirebaseCatalogRepository implements CatalogRepository {
  private readonly collectionRef

  constructor(collectionName: string) {
    this.collectionRef = collection(firestoreDb, collectionName)
  }

  async listAll(): Promise<CatalogItem[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, orderBy('name', 'asc')),
    )
    return snapshot.docs.map((item) => mapItem(item.id, item.data() as CatalogDoc))
  }

  async getById(id: string): Promise<CatalogItem | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapItem(snapshot.id, snapshot.data() as CatalogDoc)
  }

  async findByName(name: string): Promise<CatalogItem | null> {
    const key = catalogNameKey(name)
    const all = await this.listAll()
    return all.find((item) => catalogNameKey(item.name) === key) ?? null
  }

  async create(input: {
    name: string
    createdById: string
    createdByName: string
  }): Promise<CatalogItem> {
    const now = Timestamp.now()
    const id = crypto.randomUUID()
    const payload: CatalogDoc = {
      name: input.name,
      nameKey: catalogNameKey(input.name),
      createdById: input.createdById,
      createdByName: input.createdByName,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(doc(this.collectionRef, id), payload)
    return mapItem(id, payload)
  }

  async update(id: string, input: { name: string }): Promise<CatalogItem> {
    const refDoc = doc(this.collectionRef, id)
    const snapshot = await getDoc(refDoc)
    if (!snapshot.exists()) {
      throw new NotFoundError('Registro no encontrado')
    }
    const current = snapshot.data() as CatalogDoc
    const payload: CatalogDoc = {
      ...current,
      name: input.name,
      nameKey: catalogNameKey(input.name),
      updatedAt: Timestamp.now(),
    }
    await setDoc(refDoc, payload)
    return mapItem(id, payload)
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }
}
