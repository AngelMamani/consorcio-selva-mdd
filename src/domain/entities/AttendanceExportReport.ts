import {
  AttendanceOrigin,
  attendanceAttendedLabel,
  attendanceOriginLabel,
  attendanceStatusLabel,
  formatAttendanceTime,
  type Attendance,
} from '@/domain/entities/Attendance'
import type { AttendanceSettings, AttendanceOfficePoint } from '@/domain/entities/AttendanceSettings'
import { officePointsSummary, resolveOfficePoints } from '@/domain/entities/AttendanceSettings'
import { formatDateKey } from '@/domain/entities/FolderDate'

export interface AttendanceExportSourceRow {
  personName: string
  personEmail: string
  personDni: string
  personRole: string
  attendance: Attendance | null
}

export interface AttendanceExportLine {
  personName: string
  personEmail: string
  personDni: string
  personRole: string
  attendedLabel: 'Sí' | 'No'
  status: string
  originLabel: string
  officePointName: string
  timeLabel: string
  permissionNote: string
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
  officePoints: AttendanceOfficePoint[]
  officeSummary: string
  officeName: string
  officeLatitude: number
  officeLongitude: number
  officeRadiusMeters: number
  totals: {
    people: number
    office: number
    zone: number
    permiso: number
    present: number
    missing: number
  }
  all: AttendanceExportLine[]
  office: AttendanceExportLine[]
  zone: AttendanceExportLine[]
  permiso: AttendanceExportLine[]
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
      personName: row.personName,
      personEmail: row.personEmail,
      personDni: dash(row.personDni),
      personRole: dash(row.personRole),
      attendedLabel: 'No',
      status: 'No asistió',
      originLabel: '—',
      officePointName: '—',
      timeLabel: '—',
      permissionNote: '—',
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

  const hasGps = attendance.origin !== AttendanceOrigin.Permiso
  return {
    personName: row.personName,
    personEmail: row.personEmail,
    personDni: dash(row.personDni),
    personRole: dash(row.personRole),
    attendedLabel: attendanceAttendedLabel(attendance),
    status: attendanceStatusLabel(attendance),
    originLabel: attendanceOriginLabel(attendance.origin),
    officePointName: dash(attendance.areaName),
    timeLabel:
      attendance.origin === AttendanceOrigin.Permiso
        ? dash(formatAttendanceTime(attendance.createdAt))
        : formatAttendanceTime(attendance.createdAt),
    permissionNote: dash(attendance.permissionNote ?? ''),
    latitude: hasGps ? attendance.latitude : null,
    longitude: hasGps ? attendance.longitude : null,
    accuracyMeters: hasGps ? (attendance.accuracyMeters ?? null) : null,
    distanceToOfficeMeters: attendance.distanceToOfficeMeters ?? null,
    officeValidatedLabel: attendance.officeValidated ? 'Sí' : 'No',
    photoUrl: attendance.environmentPhotoUrl ?? '',
    photoPath: attendance.environmentPhotoPath ?? '',
    mapUrl: hasGps ? mapUrl(attendance.latitude, attendance.longitude) : '',
  }
}

export function buildAttendanceExportReport(input: {
  dateKey: string
  settings: AttendanceSettings
  rows: AttendanceExportSourceRow[]
  generatedByName: string
}): AttendanceExportReport {
  const all = input.rows.map(toLine)
  const office = all.filter(
    (line) => line.originLabel === attendanceOriginLabel(AttendanceOrigin.Oficina),
  )
  const zone = all.filter(
    (line) => line.originLabel === attendanceOriginLabel(AttendanceOrigin.Zona),
  )
  const permiso = all.filter(
    (line) => line.originLabel === attendanceOriginLabel(AttendanceOrigin.Permiso),
  )
  const missing = all.filter((line) => line.status === 'No asistió')
  const present = all.filter((line) => line.status === 'Asistió')

  const officePoints = resolveOfficePoints(input.settings)

  return {
    dateKey: input.dateKey,
    dateLabel: formatDateKey(input.dateKey),
    generatedAtLabel: new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      dateStyle: 'short',
      timeStyle: 'short',
    }),
    generatedByName: input.generatedByName.trim() || '—',
    officePoints,
    officeSummary: officePointsSummary(input.settings),
    officeName: input.settings.officeName,
    officeLatitude: input.settings.officeLatitude,
    officeLongitude: input.settings.officeLongitude,
    officeRadiusMeters: input.settings.officeRadiusMeters,
    totals: {
      people: all.length,
      office: office.length,
      zone: zone.length,
      permiso: permiso.length,
      present: present.length,
      missing: missing.length,
    },
    all,
    office,
    zone,
    permiso,
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
