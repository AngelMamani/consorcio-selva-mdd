import type { Attendance, AttendanceOrigin } from '@/domain/entities/Attendance'
import type { AttendanceOfficeQr } from '@/domain/entities/AttendanceOfficeQr'
import type { AttendanceSettings } from '@/domain/entities/AttendanceSettings'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'

export interface CreateAttendanceInput {
  userId: string
  userName: string
  dateKey: string
  origin: AttendanceOrigin
  areaId: string
  areaName: string
  location: GeoLocation
  distanceToOfficeMeters?: number
  officeValidated: boolean
  officeQrToken?: string
  permissionNote?: string
  markedById?: string
  markedByName?: string
  environmentPhotoUrl?: string
  environmentPhotoPath?: string
}

export interface SaveAttendanceSettingsInput {
  officePoints: Array<{
    id: string
    name: string
    latitude: number
    longitude: number
    radiusMeters: number
  }>
  updatedById: string
  updatedByName: string
}

export interface SaveAttendanceOfficeQrInput {
  dateKey: string
  token: string
  validFrom: Date
  validUntil: Date
  createdById: string
}

export interface UploadAttendanceEvidenceInput {
  userId: string
  dateKey: string
  data: Blob | ArrayBuffer | Uint8Array
  contentType: string
}

export interface AttendanceRepository {
  getSettings(): Promise<AttendanceSettings | null>
  saveSettings(input: SaveAttendanceSettingsInput): Promise<AttendanceSettings>
  getOfficeQr(dateKey: string): Promise<AttendanceOfficeQr | null>
  saveOfficeQr(input: SaveAttendanceOfficeQrInput): Promise<AttendanceOfficeQr>
  getByUserAndDate(userId: string, dateKey: string): Promise<Attendance | null>
  listByDate(dateKey: string): Promise<Attendance[]>
  listByDateRange(
    startDateKey: string,
    endDateKey: string,
  ): Promise<Attendance[]>
  create(input: CreateAttendanceInput): Promise<Attendance>
  /** Crea varios PERMISO y aprueba la solicitud en un solo batch (atómico). */
  createManyAndApproveRequest(
    attendances: CreateAttendanceInput[],
    approval: {
      requestId: string
      leaveDays: number
      startDateKey: string
      endDateKey: string
      adminNote?: string
      reviewedById: string
      reviewedByName: string
    },
  ): Promise<Attendance[]>
  uploadEvidencePhoto(
    input: UploadAttendanceEvidenceInput,
  ): Promise<{ url: string; path: string }>
}
