import {
  AttendanceOrigin,
  attendanceOriginLabel,
  formatAttendanceTime,
  type Attendance,
} from '@/domain/entities/Attendance'
import type { AttendanceSettings } from '@/domain/entities/AttendanceSettings'
import { formatDateKey } from '@/domain/entities/FolderDate'

export interface AttendanceExportSourceRow {
  technicianName: string
  technicianEmail: string
  attendance: Attendance | null
}

export interface AttendanceExportLine {
  technicianName: string
  technicianEmail: string
  status: 'Presente' | 'Sin marcar'
  originLabel: string
  timeLabel: string
  areaName: string
  latitude: number | null
  longitude: number | null
  accuracyMeters: number | null
  distanceToOfficeMeters: number | null
  officeValidatedLabel: string
  photoUrl: string
  photoPath: string
  mapUrl: string
}

export interface AttendanceExportReport {
  dateKey: string
  dateLabel: string
  generatedAtLabel: string
  generatedByName: string
  officeName: string
  officeLatitude: number
  officeLongitude: number
  officeRadiusMeters: number
  totals: {
    technicians: number
    office: number
    zone: number
    present: number
    missing: number
  }
  all: AttendanceExportLine[]
  office: AttendanceExportLine[]
  zone: AttendanceExportLine[]
  missing: AttendanceExportLine[]
  present: AttendanceExportLine[]
}

function dash(value: string): string {
  const trimmed = value.trim()
  return trimmed || '—'
}

function mapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

function toLine(row: AttendanceExportSourceRow): AttendanceExportLine {
  const attendance: Attendance | null = row.attendance
  if (!attendance) {
    return {
      technicianName: row.technicianName,
      technicianEmail: row.technicianEmail,
      status: 'Sin marcar',
      originLabel: '—',
      timeLabel: '—',
      areaName: '—',
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      distanceToOfficeMeters: null,
      officeValidatedLabel: '—',
      photoUrl: '',
      photoPath: '',
      mapUrl: '',
    }
  }

  return {
    technicianName: row.technicianName,
    technicianEmail: row.technicianEmail,
    status: 'Presente',
    originLabel: attendanceOriginLabel(attendance.origin),
    timeLabel: formatAttendanceTime(attendance.createdAt),
    areaName: dash(attendance.areaName),
    latitude: attendance.latitude,
    longitude: attendance.longitude,
    accuracyMeters: attendance.accuracyMeters ?? null,
    distanceToOfficeMeters: attendance.distanceToOfficeMeters ?? null,
    officeValidatedLabel: attendance.officeValidated ? 'Sí' : 'No',
    photoUrl: attendance.environmentPhotoUrl ?? '',
    photoPath: attendance.environmentPhotoPath ?? '',
    mapUrl: mapUrl(attendance.latitude, attendance.longitude),
  }
}

export function buildAttendanceExportReport(input: {
  dateKey: string
  settings: AttendanceSettings
  rows: AttendanceExportSourceRow[]
  generatedByName: string
}): AttendanceExportReport {
  const all = input.rows.map(toLine)
  const office = all.filter((line) => line.originLabel === attendanceOriginLabel(AttendanceOrigin.Oficina))
  const zone = all.filter((line) => line.originLabel === attendanceOriginLabel(AttendanceOrigin.Zona))
  const missing = all.filter((line) => line.status === 'Sin marcar')
  const present = all.filter((line) => line.status === 'Presente')

  return {
    dateKey: input.dateKey,
    dateLabel: formatDateKey(input.dateKey),
    generatedAtLabel: new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      dateStyle: 'short',
      timeStyle: 'short',
    }),
    generatedByName: input.generatedByName.trim() || '—',
    officeName: input.settings.officeName,
    officeLatitude: input.settings.officeLatitude,
    officeLongitude: input.settings.officeLongitude,
    officeRadiusMeters: input.settings.officeRadiusMeters,
    totals: {
      technicians: all.length,
      office: office.length,
      zone: zone.length,
      present: present.length,
      missing: missing.length,
    },
    all,
    office,
    zone,
    missing,
    present,
  }
}

export function formatExportCoord(value: number | null): string {
  return value == null ? '' : value.toFixed(6)
}

export function formatExportMeters(value: number | null): string {
  return value == null ? '' : String(value)
}
