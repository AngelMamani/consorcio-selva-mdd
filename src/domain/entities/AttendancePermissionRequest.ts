export const AttendancePermissionRequestStatus = {
  Pending: 'PENDING',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
} as const

export type AttendancePermissionRequestStatus =
  (typeof AttendancePermissionRequestStatus)[keyof typeof AttendancePermissionRequestStatus]

export function isAttendancePermissionRequestStatus(
  value: string,
): value is AttendancePermissionRequestStatus {
  return (
    value === AttendancePermissionRequestStatus.Pending ||
    value === AttendancePermissionRequestStatus.Approved ||
    value === AttendancePermissionRequestStatus.Rejected
  )
}

export function attendancePermissionRequestStatusLabel(
  status: AttendancePermissionRequestStatus,
): string {
  if (status === AttendancePermissionRequestStatus.Approved) return 'Aprobado'
  if (status === AttendancePermissionRequestStatus.Rejected) return 'Rechazado'
  return 'Pendiente'
}

export interface AttendancePermissionRequest {
  id: string
  userId: string
  userName: string
  description: string
  status: AttendancePermissionRequestStatus
  evidencePhotoUrl?: string
  evidencePhotoPath?: string
  leaveDays?: number
  startDateKey?: string
  endDateKey?: string
  adminNote?: string
  reviewedById?: string
  reviewedByName?: string
  reviewedAt?: Date
  createdAt: Date
}

export const MAX_PERMISSION_DESCRIPTION = 500
export const MIN_PERMISSION_DESCRIPTION = 8
export const MAX_LEAVE_DAYS = 30
export const MIN_LEAVE_DAYS = 1
