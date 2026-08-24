import { FirebaseError } from 'firebase/app'
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
  runTransaction,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import type { ImageFolder } from '@/domain/entities/ImageFolder'
import type {
  CreateImageFolderInput,
  ImageFolderRepository,
  UpdateImageFolderInput,
} from '@/domain/repositories/ImageFolderRepository'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'
import { isValidGeoLocation } from '@/domain/value-objects/GeoLocation'
import { isRouteCode } from '@/domain/value-objects/RouteCode'
import { NotFoundError, UnauthorizedError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface FolderDoc {
  areaId?: string
  areaName?: string
  name: string
  description: string
  ownerId: string
  ownerName: string
  assignToAllTechnicians?: boolean
  assignedTechnicianIds?: string[]
  assignedTechnicianNames?: string[]
  imageCount: number
  routeCode?: string
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
    areaId: data.areaId ?? '',
    areaName: data.areaName ?? '',
    name: data.name,
    description: data.description,
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    assignToAllTechnicians: data.assignToAllTechnicians === true,
    assignedTechnicianIds: Array.isArray(data.assignedTechnicianIds)
      ? data.assignedTechnicianIds
      : [],
    assignedTechnicianNames: Array.isArray(data.assignedTechnicianNames)
      ? data.assignedTechnicianNames
      : [],
    imageCount: data.imageCount,
    routeCode:
      data.routeCode ||
      (isRouteCode(data.name) ? data.name : undefined),
    location: mapLocation(data),
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
  }
}

function mergeFolders(groups: ImageFolder[][]): ImageFolder[] {
  const byId = new Map<string, ImageFolder>()
  for (const group of groups) {
    for (const folder of group) {
      byId.set(folder.id, folder)
    }
  }
  return [...byId.values()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
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

  async listAccessibleForUser(userId: string): Promise<ImageFolder[]> {
    const [ownedSnap, allTechsSnap, assignedSnap] = await Promise.all([
      getDocs(query(this.collectionRef, where('ownerId', '==', userId))),
      getDocs(
        query(this.collectionRef, where('assignToAllTechnicians', '==', true)),
      ),
      getDocs(
        query(
          this.collectionRef,
          where('assignedTechnicianIds', 'array-contains', userId),
        ),
      ),
    ])

    return mergeFolders([
      ownedSnap.docs.map((item) =>
        mapFolder(item.id, item.data() as FolderDoc),
      ),
      allTechsSnap.docs.map((item) =>
        mapFolder(item.id, item.data() as FolderDoc),
      ),
      assignedSnap.docs.map((item) =>
        mapFolder(item.id, item.data() as FolderDoc),
      ),
    ])
  }

  async listByArea(areaId: string): Promise<ImageFolder[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('areaId', '==', areaId)),
    )
    return snapshot.docs
      .map((item) => mapFolder(item.id, item.data() as FolderDoc))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async listWithoutArea(): Promise<ImageFolder[]> {
    const all = await this.listAll()
    return all.filter((folder) => !folder.areaId)
  }

  async create(input: CreateImageFolderInput): Promise<ImageFolder> {
    const now = Timestamp.now()
    const payload: FolderDoc = {
      areaId: input.areaId,
      areaName: input.areaName,
      name: input.name,
      description: input.description,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      assignToAllTechnicians: input.assignToAllTechnicians,
      assignedTechnicianIds: input.assignedTechnicianIds,
      assignedTechnicianNames: input.assignedTechnicianNames,
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

    try {
      if (input.id) {
        const ref = doc(this.collectionRef, input.id)
        return await runTransaction(firestoreDb, async (transaction) => {
          const snapshot = await transaction.get(ref)
          if (snapshot.exists()) {
            return mapFolder(snapshot.id, snapshot.data() as FolderDoc)
          }
          transaction.set(ref, payload)
          return mapFolder(input.id as string, payload)
        })
      }

      const created = await addDoc(this.collectionRef, payload)
      return mapFolder(created.id, payload)
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'permission-denied') {
        throw new UnauthorizedError(
          'Firestore rechazó la carpeta del suministro. Hay que publicar las reglas nuevas.',
        )
      }
      throw error
    }
  }

  async update(
    id: string,
    input: UpdateImageFolderInput,
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
    if (input.assignToAllTechnicians !== undefined) {
      patch.assignToAllTechnicians = input.assignToAllTechnicians
    }
    if (input.assignedTechnicianIds !== undefined) {
      patch.assignedTechnicianIds = input.assignedTechnicianIds
    }
    if (input.assignedTechnicianNames !== undefined) {
      patch.assignedTechnicianNames = input.assignedTechnicianNames
    }

    await updateDoc(ref, patch)
    const updated = await getDoc(ref)
    return mapFolder(id, updated.data() as FolderDoc)
  }

  async assignArea(
    id: string,
    input: { areaId: string; areaName: string },
  ): Promise<void> {
    const ref = doc(this.collectionRef, id)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      throw new NotFoundError('Carpeta no encontrada')
    }
    await updateDoc(ref, {
      areaId: input.areaId,
      areaName: input.areaName,
      updatedAt: Timestamp.now(),
    })
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
