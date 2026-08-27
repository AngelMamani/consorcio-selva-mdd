import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import type { FolderDate } from '@/domain/entities/FolderDate'
import type {
  CreateFolderDateInput,
  FolderDateRepository,
} from '@/domain/repositories/FolderDateRepository'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface FolderDateDoc {
  folderId: string
  dateKey: string
  note: string
  imageCount: number
  createdById: string
  createdByName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

function toDate(value: Timestamp | undefined): Date {
  return value?.toDate?.() ?? new Date()
}

function chunkIds(ids: string[], size = 30): string[][] {
  const unique = [...new Set(ids.filter(Boolean))]
  const chunks: string[][] = []
  for (let index = 0; index < unique.length; index += size) {
    chunks.push(unique.slice(index, index + size))
  }
  return chunks
}

function mapDate(id: string, data: FolderDateDoc): FolderDate {
  return {
    id,
    folderId: data.folderId,
    dateKey: data.dateKey,
    note: data.note ?? '',
    imageCount: data.imageCount ?? 0,
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export class FirebaseFolderDateRepository implements FolderDateRepository {
  private readonly collectionRef = collection(firestoreDb, 'folderDates')

  async getById(id: string): Promise<FolderDate | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapDate(snapshot.id, snapshot.data() as FolderDateDoc)
  }

  async listByFolder(folderId: string): Promise<FolderDate[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('folderId', '==', folderId)),
    )
    return snapshot.docs
      .map((item) => mapDate(item.id, item.data() as FolderDateDoc))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }

  async listByFolderIds(folderIds: string[]): Promise<FolderDate[]> {
    const chunks = chunkIds(folderIds)
    if (chunks.length === 0) return []
    const nested = await Promise.all(
      chunks.map(async (chunk) => {
        const snapshot = await getDocs(
          query(this.collectionRef, where('folderId', 'in', chunk)),
        )
        return snapshot.docs.map((item) =>
          mapDate(item.id, item.data() as FolderDateDoc),
        )
      }),
    )
    return nested
      .flat()
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }

  async findByFolderAndDateKey(
    folderId: string,
    dateKey: string,
  ): Promise<FolderDate | null> {
    const snapshot = await getDocs(
      query(
        this.collectionRef,
        where('folderId', '==', folderId),
        where('dateKey', '==', dateKey),
      ),
    )
    const first = snapshot.docs[0]
    if (!first) return null
    return mapDate(first.id, first.data() as FolderDateDoc)
  }

  async create(input: CreateFolderDateInput): Promise<FolderDate> {
    const now = Timestamp.now()
    const payload: FolderDateDoc = {
      folderId: input.folderId,
      dateKey: input.dateKey,
      note: input.note,
      imageCount: 0,
      createdById: input.createdById,
      createdByName: input.createdByName,
      createdAt: now,
      updatedAt: now,
    }
    const created = await addDoc(this.collectionRef, payload)
    return mapDate(created.id, payload)
  }

  async incrementImageCount(dateId: string, delta: number): Promise<void> {
    const ref = doc(this.collectionRef, dateId)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      throw new NotFoundError('Fecha no encontrada')
    }
    await updateDoc(ref, {
      imageCount: increment(delta),
      updatedAt: Timestamp.now(),
    })
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }

  async deleteAllByFolder(folderId: string): Promise<void> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('folderId', '==', folderId)),
    )
    await Promise.all(
      snapshot.docs.map(async (item) => {
        try {
          await deleteDoc(item.ref)
        } catch {
          // Sigue con el resto de fechas.
        }
      }),
    )
  }
}
