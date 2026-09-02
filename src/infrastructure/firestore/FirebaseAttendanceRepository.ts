import { FirebaseError } from 'firebase/app'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import type { Attendance } from '@/domain/entities/Attendance'
import {
  attendanceDocId,
  buildOfficeQrPayload,
  isAttendanceOrigin,
} from '@/domain/entities/Attendance'
import type { AttendanceOfficeQr } from '@/domain/entities/AttendanceOfficeQr'
import type { AttendanceSettings } from '@/domain/entities/AttendanceSettings'
import {
  normalizeAttendanceSettings,
  normalizeOfficeRadiusMeters,
} from '@/domain/entities/AttendanceSettings'
import type {
  AttendanceRepository,
  CreateAttendanceInput,
  SaveAttendanceOfficeQrInput,
  SaveAttendanceSettingsInput,
} from '@/domain/repositories/AttendanceRepository'
import { UnauthorizedError, ValidationError } from '@/domain/errors/DomainError'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

interface AttendanceDoc {
  userId: string
  userName: string
  dateKey: string
  origin: string
  areaId: string
  areaName: string
  latitude: number
  longitude: number
  locationAccuracy?: number
  distanceToOfficeMeters?: number
  officeValidated: boolean
  officeQrToken?: string
  permissionNote?: string
  markedById?: string
  markedByName?: string
  environmentPhotoUrl?: string
  environmentPhotoPath?: string
  createdAt: Timestamp
}

interface SettingsDoc {
  officeName: string
  officeLatitude: number
  officeLongitude: number
  officeRadiusMeters: number
  officePoints?: Array<{
    id: string
    name: string
    latitude: number
    longitude: number
    radiusMeters: number
  }>
  updatedAt: Timestamp
  updatedById: string
  updatedByName: string
}

interface OfficeQrDoc {
  dateKey: string
  token: string
  validFrom: Timestamp
  validUntil: Timestamp
  createdAt: Timestamp
  createdById: string
}

function mapFirebaseWriteError(error: unknown, fallback: string): never {
  if (error instanceof ValidationError || error instanceof UnauthorizedError) {
    throw error
  }
  if (error instanceof FirebaseError && error.code === 'permission-denied') {
    throw new UnauthorizedError(
      'No se pudo registrar. Revisa el GPS, el radio de oficina o si ya hay una marca ese día.',
    )
  }
  throw new ValidationError(fallback)
}

function mapAttendance(id: string, data: AttendanceDoc): Attendance | null {
  if (!isAttendanceOrigin(data.origin)) return null
  return {
    id,
    userId: data.userId,
    userName: data.userName,
    dateKey: data.dateKey,
    origin: data.origin,
    areaId: data.areaId ?? '',
    areaName: data.areaName ?? '',
    latitude: data.latitude,
    longitude: data.longitude,
    accuracyMeters:
      typeof data.locationAccuracy === 'number'
        ? data.locationAccuracy
        : undefined,
    distanceToOfficeMeters:
      typeof data.distanceToOfficeMeters === 'number'
        ? data.distanceToOfficeMeters
        : undefined,
    officeValidated: data.officeValidated === true,
    permissionNote: data.permissionNote?.trim() || undefined,
    markedById: data.markedById || undefined,
    markedByName: data.markedByName || undefined,
    environmentPhotoUrl: data.environmentPhotoUrl || undefined,
    environmentPhotoPath: data.environmentPhotoPath || undefined,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  }
}

function mapOfficeQr(data: OfficeQrDoc): AttendanceOfficeQr {
  return {
    dateKey: data.dateKey,
    token: data.token,
    payload: buildOfficeQrPayload(data.dateKey, data.token),
    validFrom: data.validFrom.toDate(),
    validUntil: data.validUntil.toDate(),
    createdAt: data.createdAt.toDate(),
    createdById: data.createdById,
  }
}

export class FirebaseAttendanceRepository implements AttendanceRepository {
  private readonly collectionRef = collection(firestoreDb, 'attendances')
  private readonly settingsRef = doc(firestoreDb, 'settings', 'attendance')
  private readonly officeQrCollection = collection(
    firestoreDb,
    'attendanceOfficeTokens',
  )

  async getSettings(): Promise<AttendanceSettings | null> {
    const snapshot = await getDoc(this.settingsRef)
    if (!snapshot.exists()) return null
    const data = snapshot.data() as SettingsDoc
    return normalizeAttendanceSettings({
      officePoints: data.officePoints,
      officeName: data.officeName,
      officeLatitude: data.officeLatitude,
      officeLongitude: data.officeLongitude,
      officeRadiusMeters: normalizeOfficeRadiusMeters(data.officeRadiusMeters),
      updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
      updatedById: data.updatedById ?? '',
      updatedByName: data.updatedByName ?? '',
    })
  }

  async saveSettings(
    input: SaveAttendanceSettingsInput,
  ): Promise<AttendanceSettings> {
    const now = Timestamp.now()
    const normalized = normalizeAttendanceSettings({
      officePoints: input.officePoints,
      updatedAt: now.toDate(),
      updatedById: input.updatedById,
      updatedByName: input.updatedByName,
    })
    const payload: SettingsDoc = {
      officeName: normalized.officeName,
      officeLatitude: normalized.officeLatitude,
      officeLongitude: normalized.officeLongitude,
      officeRadiusMeters: normalized.officeRadiusMeters,
      officePoints: normalized.officePoints.map((point) => ({
        id: point.id,
        name: point.name,
        latitude: point.latitude,
        longitude: point.longitude,
        radiusMeters: point.radiusMeters,
      })),
      updatedAt: now,
      updatedById: input.updatedById,
      updatedByName: input.updatedByName,
    }
    await setDoc(this.settingsRef, payload)
    return normalized
  }

  async getOfficeQr(dateKey: string): Promise<AttendanceOfficeQr | null> {
    const snapshot = await getDoc(doc(this.officeQrCollection, dateKey))
    if (!snapshot.exists()) return null
    return mapOfficeQr(snapshot.data() as OfficeQrDoc)
  }

  async saveOfficeQr(
    input: SaveAttendanceOfficeQrInput,
  ): Promise<AttendanceOfficeQr> {
    const now = Timestamp.now()
    const payload: OfficeQrDoc = {
      dateKey: input.dateKey,
      token: input.token,
      validFrom: Timestamp.fromDate(input.validFrom),
      validUntil: Timestamp.fromDate(input.validUntil),
      createdAt: now,
      createdById: input.createdById,
    }
    await setDoc(doc(this.officeQrCollection, input.dateKey), payload)
    return mapOfficeQr(payload)
  }

  async getByUserAndDate(
    userId: string,
    dateKey: string,
  ): Promise<Attendance | null> {
    const snapshot = await getDoc(
      doc(this.collectionRef, attendanceDocId(userId, dateKey)),
    )
    if (!snapshot.exists()) return null
    return mapAttendance(snapshot.id, snapshot.data() as AttendanceDoc)
  }

  async listByDate(dateKey: string): Promise<Attendance[]> {
    const snapshot = await getDocs(
      query(this.collectionRef, where('dateKey', '==', dateKey)),
    )
    return snapshot.docs
      .map((item) => mapAttendance(item.id, item.data() as AttendanceDoc))
      .filter((item): item is Attendance => item !== null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  async create(input: CreateAttendanceInput): Promise<Attendance> {
    const id = attendanceDocId(input.userId, input.dateKey)
    const ref = doc(this.collectionRef, id)
    const existing = await getDoc(ref)
    if (existing.exists()) {
      throw new ValidationError('Ya marcaste asistencia hoy')
    }

    const now = Timestamp.now()
    const payload: AttendanceDoc = {
      userId: input.userId,
      userName: input.userName,
      dateKey: input.dateKey,
      origin: input.origin,
      areaId: input.areaId,
      areaName: input.areaName,
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      officeValidated: input.officeValidated,
      createdAt: now,
    }
    if (typeof input.location.accuracyMeters === 'number') {
      payload.locationAccuracy = input.location.accuracyMeters
    }
    if (typeof input.distanceToOfficeMeters === 'number') {
      payload.distanceToOfficeMeters = input.distanceToOfficeMeters
    }
    if (input.officeQrToken) {
      payload.officeQrToken = input.officeQrToken
    }
    if (input.permissionNote) {
      payload.permissionNote = input.permissionNote
    }
    if (input.markedById && input.markedByName) {
      payload.markedById = input.markedById
      payload.markedByName = input.markedByName
    }
    if (input.environmentPhotoUrl && input.environmentPhotoPath) {
      payload.environmentPhotoUrl = input.environmentPhotoUrl
      payload.environmentPhotoPath = input.environmentPhotoPath
    }

    try {
      await setDoc(ref, payload)
    } catch (error) {
      mapFirebaseWriteError(error, 'No se pudo marcar la asistencia')
    }
    return mapAttendance(id, payload) as Attendance
  }
}
