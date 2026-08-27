import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import type { FolderImage } from '@/domain/entities/FolderImage'
import type {
  CreateFolderImageInput,
  FolderImageRepository,
} from '@/domain/repositories/FolderImageRepository'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'
import { isValidGeoLocation } from '@/domain/value-objects/GeoLocation'
import {
  firebaseStorage,
  firestoreDb,
} from '@/infrastructure/firebase/firebaseApp'

interface ImageDoc {
  folderId: string
  dateId?: string
  fileName: string
  storagePath: string
  downloadUrl: string
  contentType: string
  sizeBytes: number
  uploadedById: string
  uploadedByName: string
  latitude?: number
  longitude?: number
  locationAccuracy?: number
  locationCapturedAt?: Timestamp
  createdAt: Timestamp
}

function mapLocation(data: ImageDoc): GeoLocation | undefined {
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

function mapImage(id: string, data: ImageDoc): FolderImage {
  return {
    id,
    folderId: data.folderId,
    dateId: data.dateId ?? '',
    fileName: data.fileName,
    storagePath: data.storagePath,
    downloadUrl: data.downloadUrl,
    contentType: data.contentType,
    sizeBytes: data.sizeBytes,
    uploadedById: data.uploadedById,
    uploadedByName: data.uploadedByName,
    location: mapLocation(data),
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-() ]+/g, '_').slice(0, 120)
}

function chunkIds(ids: string[], size = 30): string[][] {
  const unique = [...new Set(ids.filter(Boolean))]
  const chunks: string[][] = []
  for (let index = 0; index < unique.length; index += size) {
    chunks.push(unique.slice(index, index + size))
  }
  return chunks
}

export class FirebaseFolderImageRepository implements FolderImageRepository {
  private readonly collectionRef = collection(firestoreDb, 'folderImages')

  async listByFolder(folderId: string): Promise<FolderImage[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('folderId', '==', folderId)),
    )
    return snapshot.docs
      .map((item) => mapImage(item.id, item.data() as ImageDoc))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async listByFolderIds(folderIds: string[]): Promise<FolderImage[]> {
    const chunks = chunkIds(folderIds)
    if (chunks.length === 0) return []
    const nested = await Promise.all(
      chunks.map(async (chunk) => {
        const snapshot = await getDocs(
          query(this.collectionRef, where('folderId', 'in', chunk)),
        )
        return snapshot.docs.map((item) =>
          mapImage(item.id, item.data() as ImageDoc),
        )
      }),
    )
    return nested
      .flat()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async listByDate(folderId: string, dateId: string): Promise<FolderImage[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('dateId', '==', dateId)),
    )
    return snapshot.docs
      .map((item) => mapImage(item.id, item.data() as ImageDoc))
      .filter((image) => image.folderId === folderId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async create(input: CreateFolderImageInput): Promise<FolderImage> {
    const imageId = crypto.randomUUID()
    const safeName = sanitizeFileName(input.file.fileName)
    const storagePath = `folders/${input.folderId}/${input.dateId}/${imageId}_${safeName}`
    const storageRef = ref(firebaseStorage, storagePath)

    await uploadBytes(storageRef, input.file.data, {
      contentType: input.file.contentType,
    })

    const downloadUrl = await getDownloadURL(storageRef)
    const now = Timestamp.now()
    const payload: ImageDoc = {
      folderId: input.folderId,
      dateId: input.dateId,
      fileName: input.file.fileName,
      storagePath,
      downloadUrl,
      contentType: input.file.contentType,
      sizeBytes: input.file.sizeBytes,
      uploadedById: input.uploadedById,
      uploadedByName: input.uploadedByName,
      createdAt: now,
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
    return mapImage(created.id, payload)
  }

  async delete(image: FolderImage): Promise<void> {
    await deleteObject(ref(firebaseStorage, image.storagePath)).catch(
      () => undefined,
    )
    await deleteDoc(doc(this.collectionRef, image.id))
  }

  async deleteAllByFolder(folderId: string): Promise<void> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('folderId', '==', folderId)),
    )
    await Promise.all(
      snapshot.docs.map(async (item) => {
        try {
          const storagePath = item.data().storagePath
          if (typeof storagePath === 'string' && storagePath) {
            await deleteObject(ref(firebaseStorage, storagePath)).catch(
              () => undefined,
            )
          }
          await deleteDoc(item.ref)
        } catch {
          // Sigue con el resto: la carpeta se borra igual.
        }
      }),
    )
  }

  async deleteAllByDate(folderId: string, dateId: string): Promise<void> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('dateId', '==', dateId)),
    )
    await Promise.all(
      snapshot.docs
        .filter((item) => item.data().folderId === folderId)
        .map(async (item) => {
          try {
            const storagePath = item.data().storagePath
            if (typeof storagePath === 'string' && storagePath) {
              await deleteObject(ref(firebaseStorage, storagePath)).catch(
                () => undefined,
              )
            }
            await deleteDoc(item.ref)
          } catch {
            // Sigue con el resto de imágenes de la fecha.
          }
        }),
    )
  }
}
