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
  environmentPhotoUrl: string
  environmentPhotoPath: string
}

export interface SaveAttendanceSettingsInput {
  officeName: string
  officeLatitude: number
  officeLongitude: number
  officeRadiusMeters: number
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

export interface AttendanceRepository {
  getSettings(): Promise<AttendanceSettings | null>
  saveSettings(input: SaveAttendanceSettingsInput): Promise<AttendanceSettings>
  getOfficeQr(dateKey: string): Promise<AttendanceOfficeQr | null>
  saveOfficeQr(input: SaveAttendanceOfficeQrInput): Promise<AttendanceOfficeQr>
  getByUserAndDate(userId: string, dateKey: string): Promise<Attendance | null>
  listByDate(dateKey: string): Promise<Attendance[]>
  create(input: CreateAttendanceInput): Promise<Attendance>
}
