import type { AttendancePermissionRequest } from '@/domain/entities/AttendancePermissionRequest'

export interface CreateAttendancePermissionRequestInput {
  userId: string
  userName: string
  description: string
  evidencePhotoUrl?: string
  evidencePhotoPath?: string
}

export interface ApproveAttendancePermissionRequestInput {
  requestId: string
  leaveDays: number
  startDateKey: string
  endDateKey: string
  adminNote?: string
  reviewedById: string
  reviewedByName: string
}

export interface RejectAttendancePermissionRequestInput {
  requestId: string
  adminNote?: string
  reviewedById: string
  reviewedByName: string
}

export interface UploadPermissionEvidenceInput {
  userId: string
  fileId: string
  data: Blob | ArrayBuffer | Uint8Array
  contentType: string
}

export interface AttendancePermissionRequestRepository {
  create(
    input: CreateAttendancePermissionRequestInput,
  ): Promise<AttendancePermissionRequest>
  getById(requestId: string): Promise<AttendancePermissionRequest | null>
  listPending(): Promise<AttendancePermissionRequest[]>
  listByUser(userId: string): Promise<AttendancePermissionRequest[]>
  listPendingByUser(userId: string): Promise<AttendancePermissionRequest[]>
  approve(
    input: ApproveAttendancePermissionRequestInput,
  ): Promise<AttendancePermissionRequest>
  reject(
    input: RejectAttendancePermissionRequestInput,
  ): Promise<AttendancePermissionRequest>
  uploadEvidencePhoto(
    input: UploadPermissionEvidenceInput,
  ): Promise<{ url: string; path: string }>
}
