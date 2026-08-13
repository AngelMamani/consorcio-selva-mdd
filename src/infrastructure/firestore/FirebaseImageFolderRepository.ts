import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type {
  CreateImageFolderInput,
  ImageFolderRepository,
} from '@/domain/repositories/ImageFolderRepository'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'
import { isValidGeoLocation } from '@/domain/value-objects/GeoLocation'
import { NotFoundError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface FolderDoc {
  name: string
  description: string
  ownerId: string
  ownerName: string
  imageCount: number
  latitude?: number
  longitude?: number
  locationAccuracy?: number
  locationCapturedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

function mapLocation(data: FolderDoc): GeoLocation | undefined {
  if (!isValidGeoLocation(data.latitude, data.longitude)) return undefined
  return {
    latitude: data.latitude as number,
    longitude: data.longitude as number,
    accuracyMeters:
      typeof data.locationAccuracy === 'number'
        ? data.locationAccuracy
        : undefined,
    capturedAt: data.locationCapturedAt?.toDate(),
  }
}

function mapFolder(id: string, data: FolderDoc): ImageFolder {
  return {
    id,
    name: data.name,
    description: data.description,
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    imageCount: data.imageCount,
    location: mapLocation(data),
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

export class FirebaseImageFolderRepository implements ImageFolderRepository {
  private readonly collectionRef = collection(firestoreDb, 'folders')

  async getById(id: string): Promise<ImageFolder | null> {
    const snapshot = await getDoc(doc(this.collectionRef, id))
    if (!snapshot.exists()) return null
    return mapFolder(snapshot.id, snapshot.data() as FolderDoc)
  }

  async listAll(): Promise<ImageFolder[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, orderBy('createdAt', 'desc')),
    )
    return snapshot.docs.map((item) =>
      mapFolder(item.id, item.data() as FolderDoc),
    )
  }

  async listByOwner(ownerId: string): Promise<ImageFolder[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('ownerId', '==', ownerId)),
    )
    return snapshot.docs
      .map((item) => mapFolder(item.id, item.data() as FolderDoc))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async create(input: CreateImageFolderInput): Promise<ImageFolder> {
    const now = Timestamp.now()
    const payload: FolderDoc = {
      name: input.name,
      description: input.description,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      imageCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    if (input.location) {
      payload.latitude = input.location.latitude
      payload.longitude = input.location.longitude
      if (typeof input.location.accuracyMeters === 'number') {
        payload.locationAccuracy = input.location.accuracyMeters
      }
      payload.locationCapturedAt = input.location.capturedAt
        ? Timestamp.fromDate(input.location.capturedAt)
        : now
    }

    const created = await addDoc(this.collectionRef, payload)
    return mapFolder(created.id, payload)
  }

  async update(
    id: string,
    input: { name?: string; description?: string },
  ): Promise<ImageFolder> {
    const ref = doc(this.collectionRef, id)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    const patch: Partial<FolderDoc> = {
      updatedAt: Timestamp.now(),
    }
    if (input.name !== undefined) patch.name = input.name
    if (input.description !== undefined) patch.description = input.description

    await updateDoc(ref, patch)
    const updated = await getDoc(ref)
    return mapFolder(id, updated.data() as FolderDoc)
  }

  async incrementImageCount(folderId: string, delta: number): Promise<void> {
    const ref = doc(this.collectionRef, folderId)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      throw new NotFoundError('Carpeta no encontrada')
    }

    await updateDoc(ref, {
      imageCount: increment(delta),
      updatedAt: Timestamp.now(),
    })
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.collectionRef, id))
  }
}
