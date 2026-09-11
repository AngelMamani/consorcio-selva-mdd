import { FirebaseError } from 'firebase/app'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import type { AttendancePermissionRequest } from '@/domain/entities/AttendancePermissionRequest'
import {
  AttendancePermissionRequestStatus,
  isAttendancePermissionRequestStatus,
} from '@/domain/entities/AttendancePermissionRequest'
import type {
  ApproveAttendancePermissionRequestInput,
  AttendancePermissionRequestRepository,
  CreateAttendancePermissionRequestInput,
  RejectAttendancePermissionRequestInput,
  UploadPermissionEvidenceInput,
} from '@/domain/repositories/AttendancePermissionRequestRepository'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'
import { firestoreDb, firebaseStorage } from '@/infrastructure/firebase/firebaseApp'

interface PermissionRequestDoc {
  userId: string
  userName: string
  description: string
  status: string
  evidencePhotoUrl?: string
  evidencePhotoPath?: string
  leaveDays?: number
  startDateKey?: string
  endDateKey?: string
  adminNote?: string
  reviewedById?: string
  reviewedByName?: string
  reviewedAt?: Timestamp
  createdAt: Timestamp
}

function mapRequest(
  id: string,
  data: PermissionRequestDoc,
): AttendancePermissionRequest | null {
  if (!isAttendancePermissionRequestStatus(data.status)) return null
  return {
    id,
    userId: data.userId,
    userName: data.userName,
    description: data.description,
    status: data.status,
    evidencePhotoUrl: data.evidencePhotoUrl || undefined,
    evidencePhotoPath: data.evidencePhotoPath || undefined,
    leaveDays:
      typeof data.leaveDays === 'number' ? data.leaveDays : undefined,
    startDateKey: data.startDateKey || undefined,
    endDateKey: data.endDateKey || undefined,
    adminNote: data.adminNote || undefined,
    reviewedById: data.reviewedById || undefined,
    reviewedByName: data.reviewedByName || undefined,
    reviewedAt: data.reviewedAt?.toDate?.(),
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  }
}

function mapWriteError(error: unknown, fallback: string): never {
  if (error instanceof ValidationError || error instanceof UnauthorizedError) {
    throw error
  }
  if (error instanceof FirebaseError && error.code === 'permission-denied') {
    throw new UnauthorizedError(
      'No se pudo guardar la solicitud de permiso. Revisa tu sesión.',
    )
  }
  throw new ValidationError(fallback)
}

export class FirebaseAttendancePermissionRequestRepository
  implements AttendancePermissionRequestRepository
{
  private readonly collectionRef = collection(
    firestoreDb,
    'attendancePermissionRequests',
  )

  async create(
    input: CreateAttendancePermissionRequestInput,
  ): Promise<AttendancePermissionRequest> {
    const now = Timestamp.now()
    const payload: PermissionRequestDoc = {
      userId: input.userId,
      userName: input.userName,
      description: input.description,
      status: AttendancePermissionRequestStatus.Pending,
      createdAt: now,
    }
    if (input.evidencePhotoUrl && input.evidencePhotoPath) {
      payload.evidencePhotoUrl = input.evidencePhotoUrl
      payload.evidencePhotoPath = input.evidencePhotoPath
    }
    try {
      const created = await addDoc(this.collectionRef, payload)
      return mapRequest(created.id, payload) as AttendancePermissionRequest
    } catch (error) {
      mapWriteError(error, 'No se pudo enviar la solicitud de permiso')
    }
  }

  async getById(requestId: string): Promise<AttendancePermissionRequest | null> {
    const snapshot = await getDoc(doc(this.collectionRef, requestId))
    if (!snapshot.exists()) return null
    return mapRequest(snapshot.id, snapshot.data() as PermissionRequestDoc)
  }

  async listPending(): Promise<AttendancePermissionRequest[]> {
    const snapshot = await getDocs(
      query(
        this.collectionRef,
        where('status', '==', AttendancePermissionRequestStatus.Pending),
        orderBy('createdAt', 'asc'),
      ),
    )
    return snapshot.docs
      .map((item) => mapRequest(item.id, item.data() as PermissionRequestDoc))
      .filter((item): item is AttendancePermissionRequest => item !== null)
  }

  async listByUser(userId: string): Promise<AttendancePermissionRequest[]> {
    const snapshot = await getDocs(
      query(
        this.collectionRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
      ),
    )
    return snapshot.docs
      .map((item) => mapRequest(item.id, item.data() as PermissionRequestDoc))
      .filter((item): item is AttendancePermissionRequest => item !== null)
  }

  async listPendingByUser(
    userId: string,
  ): Promise<AttendancePermissionRequest[]> {
    const snapshot = await getDocs(
      query(
        this.collectionRef,
        where('userId', '==', userId),
        where('status', '==', AttendancePermissionRequestStatus.Pending),
      ),
    )
    return snapshot.docs
      .map((item) => mapRequest(item.id, item.data() as PermissionRequestDoc))
      .filter((item): item is AttendancePermissionRequest => item !== null)
  }

  async approve(
    input: ApproveAttendancePermissionRequestInput,
  ): Promise<AttendancePermissionRequest> {
    const refDoc = doc(this.collectionRef, input.requestId)
    const now = Timestamp.now()
    try {
      await updateDoc(refDoc, {
        status: AttendancePermissionRequestStatus.Approved,
        leaveDays: input.leaveDays,
        startDateKey: input.startDateKey,
        endDateKey: input.endDateKey,
        adminNote: input.adminNote ?? '',
        reviewedById: input.reviewedById,
        reviewedByName: input.reviewedByName,
        reviewedAt: now,
      })
    } catch (error) {
      mapWriteError(error, 'No se pudo aprobar la solicitud')
    }
    const updated = await this.getById(input.requestId)
    if (!updated) throw new ValidationError('No se pudo aprobar la solicitud')
    return updated
  }

  async reject(
    input: RejectAttendancePermissionRequestInput,
  ): Promise<AttendancePermissionRequest> {
    const refDoc = doc(this.collectionRef, input.requestId)
    const now = Timestamp.now()
    try {
      await updateDoc(refDoc, {
        status: AttendancePermissionRequestStatus.Rejected,
        adminNote: input.adminNote ?? '',
        reviewedById: input.reviewedById,
        reviewedByName: input.reviewedByName,
        reviewedAt: now,
      })
    } catch (error) {
      mapWriteError(error, 'No se pudo rechazar la solicitud')
    }
    const updated = await this.getById(input.requestId)
    if (!updated) throw new ValidationError('No se pudo rechazar la solicitud')
    return updated
  }

  async uploadEvidencePhoto(
    input: UploadPermissionEvidenceInput,
  ): Promise<{ url: string; path: string }> {
    const path = `attendances/${input.userId}/permission-requests/${input.fileId}.jpg`
    const storageRef = ref(firebaseStorage, path)
    try {
      await uploadBytes(storageRef, input.data, {
        contentType: input.contentType || 'image/jpeg',
      })
      const url = await getDownloadURL(storageRef)
      return { url, path }
    } catch (error) {
      mapWriteError(error, 'No se pudo subir la foto de la solicitud')
    }
  }
}
