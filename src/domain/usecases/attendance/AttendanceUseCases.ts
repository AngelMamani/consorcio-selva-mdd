import type { Attendance } from '@/domain/entities/Attendance'
import {
  AttendanceOrigin,
  addLimaDateKeys,
  isAttendanceOrigin,
  toLimaDateKey,
} from '@/domain/entities/Attendance'
import type { AttendancePermissionRequest } from '@/domain/entities/AttendancePermissionRequest'
import {
  AttendancePermissionRequestStatus,
  MAX_LEAVE_DAYS,
  MAX_PERMISSION_DESCRIPTION,
  MIN_LEAVE_DAYS,
  MIN_PERMISSION_DESCRIPTION,
} from '@/domain/entities/AttendancePermissionRequest'
import type { AttendanceSettings } from '@/domain/entities/AttendanceSettings'
import {
  defaultAttendanceSettings,
  findMatchingOfficePoint,
  MAX_OFFICE_POINTS,
  MAX_OFFICE_RADIUS_METERS,
  MIN_OFFICE_RADIUS_METERS,
  normalizeAttendanceSettings,
  normalizeOfficePoint,
  normalizeOfficeRadiusMeters,
  resolveOfficePoints,
} from '@/domain/entities/AttendanceSettings'
import type { User } from '@/domain/entities/User'
import {
  assertUserCanManageUsers,
  uniqueUsersByAccessDni,
} from '@/domain/entities/User'
import type { AttendancePermissionRequestRepository } from '@/domain/repositories/AttendancePermissionRequestRepository'
import type { AttendanceRepository } from '@/domain/repositories/AttendanceRepository'
import type { UserRepository } from '@/domain/repositories/UserRepository'
import type { GeoLocation } from '@/domain/value-objects/GeoLocation'
import { isValidGeoLocation } from '@/domain/value-objects/GeoLocation'
import { UserRole } from '@/domain/value-objects/UserRole'
import { distanceMeters } from '@/domain/services/GeoDistanceService'
import { isDateKey } from '@/domain/entities/FolderDate'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

export interface AttendanceDayRow {
  person: User
  attendance: Attendance | null
}

export interface AttendancePeriodRow {
  person: User
  byDate: Record<string, Attendance | null>
}

const PERMISO_LOCATION: GeoLocation = { latitude: 0, longitude: 0 }

function trimPermissionNote(note: string | undefined): string {
  return (note ?? '').trim().slice(0, 200)
}

export class GetAttendanceSettingsUseCase {
  private readonly attendanceRepository: AttendanceRepository

  constructor(attendanceRepository: AttendanceRepository) {
    this.attendanceRepository = attendanceRepository
  }

  async execute(actor: User): Promise<AttendanceSettings> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    const settings = await this.attendanceRepository.getSettings()
    const resolved = normalizeAttendanceSettings(settings ?? defaultAttendanceSettings())
    return resolved
  }
}

export class SaveAttendanceSettingsUseCase {
  private readonly attendanceRepository: AttendanceRepository

  constructor(attendanceRepository: AttendanceRepository) {
    this.attendanceRepository = attendanceRepository
  }

  async execute(
    actor: User,
    input: {
      officePoints: Array<{
        id: string
        name: string
        latitude: number
        longitude: number
        radiusMeters: number
      }>
    },
  ): Promise<AttendanceSettings> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede configurar los puntos de oficina',
      )
    }

    if (!Array.isArray(input.officePoints) || input.officePoints.length === 0) {
      throw new ValidationError('Agrega al menos un punto de oficina')
    }
    if (input.officePoints.length > MAX_OFFICE_POINTS) {
      throw new ValidationError(
        `Puedes configurar hasta ${MAX_OFFICE_POINTS} puntos de oficina`,
      )
    }

    const officePoints = input.officePoints.map((point) => {
      const name = point.name.trim()
      if (!name) {
        throw new ValidationError('Cada punto debe tener un nombre')
      }
      if (name.length > 120) {
        throw new ValidationError('El nombre no debe superar 120 caracteres')
      }
      if (!isValidGeoLocation(point.latitude, point.longitude)) {
        throw new ValidationError(`La ubicación de «${name}» no es válida`)
      }
      const radius = normalizeOfficeRadiusMeters(point.radiusMeters)
      if (
        Math.round(point.radiusMeters) < MIN_OFFICE_RADIUS_METERS ||
        Math.round(point.radiusMeters) > MAX_OFFICE_RADIUS_METERS
      ) {
        throw new ValidationError(
          `El radio de «${name}» debe estar entre ${MIN_OFFICE_RADIUS_METERS} y ${MAX_OFFICE_RADIUS_METERS} metros`,
        )
      }
      return normalizeOfficePoint({
        id: point.id,
        name,
        latitude: point.latitude,
        longitude: point.longitude,
        radiusMeters: radius,
      })
    })

    return this.attendanceRepository.saveSettings({
      officePoints,
      updatedById: actor.id,
      updatedByName: actor.displayName,
    })
  }
}

export class GetMyTodayAttendanceUseCase {
  private readonly attendanceRepository: AttendanceRepository

  constructor(attendanceRepository: AttendanceRepository) {
    this.attendanceRepository = attendanceRepository
  }

  async execute(actor: User, dateKey = toLimaDateKey()): Promise<Attendance | null> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    return this.attendanceRepository.getByUserAndDate(actor.id, dateKey)
  }
}

export class ListAttendanceDayUseCase {
  private readonly attendanceRepository: AttendanceRepository
  private readonly userRepository: UserRepository

  constructor(
    attendanceRepository: AttendanceRepository,
    userRepository: UserRepository,
  ) {
    this.attendanceRepository = attendanceRepository
    this.userRepository = userRepository
  }

  async execute(actor: User, dateKey: string): Promise<AttendanceDayRow[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    if (!isDateKey(dateKey)) {
      throw new ValidationError('La fecha no es válida')
    }

    if (
      actor.role !== UserRole.Administrador &&
      actor.role !== UserRole.SuperAdministrador
    ) {
      const own = await this.attendanceRepository.getByUserAndDate(
        actor.id,
        dateKey,
      )
      return [{ person: actor, attendance: own }]
    }

    const [people, attendances] = await Promise.all([
      this.userRepository.listAll(),
      this.attendanceRepository.listByDate(dateKey),
    ])

    const byUser = new Map(attendances.map((item) => [item.userId, item]))
    return uniqueUsersByAccessDni(people)
      .filter((user) => user.active)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
      .map((person) => ({
        person,
        attendance: byUser.get(person.id) ?? null,
      }))
  }
}

export class ListAttendancePeriodUseCase {
  private readonly attendanceRepository: AttendanceRepository
  private readonly userRepository: UserRepository

  constructor(
    attendanceRepository: AttendanceRepository,
    userRepository: UserRepository,
  ) {
    this.attendanceRepository = attendanceRepository
    this.userRepository = userRepository
  }

  async execute(
    actor: User,
    dateKeys: string[],
  ): Promise<AttendancePeriodRow[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    if (dateKeys.length === 0 || dateKeys.some((key) => !isDateKey(key))) {
      throw new ValidationError('El rango de fechas no es válido')
    }

    const startDateKey = dateKeys[0] ?? ''
    const endDateKey = dateKeys[dateKeys.length - 1] ?? startDateKey

    if (
      actor.role !== UserRole.Administrador &&
      actor.role !== UserRole.SuperAdministrador
    ) {
      const ownMarks = await Promise.all(
        dateKeys.map((key) =>
          this.attendanceRepository.getByUserAndDate(actor.id, key),
        ),
      )
      const byDate: Record<string, Attendance | null> = {}
      dateKeys.forEach((key, index) => {
        byDate[key] = ownMarks[index] ?? null
      })
      return [{ person: actor, byDate }]
    }

    const [people, attendances] = await Promise.all([
      this.userRepository.listAll(),
      this.attendanceRepository.listByDateRange(startDateKey, endDateKey),
    ])

    const byUserDate = new Map<string, Attendance>()
    for (const item of attendances) {
      byUserDate.set(`${item.userId}_${item.dateKey}`, item)
    }

    return uniqueUsersByAccessDni(people)
      .filter((user) => user.active)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
      .map((person) => {
        const byDate: Record<string, Attendance | null> = {}
        for (const key of dateKeys) {
          byDate[key] = byUserDate.get(`${person.id}_${key}`) ?? null
        }
        return { person, byDate }
      })
  }
}

export class MarkAttendanceUseCase {
  private readonly attendanceRepository: AttendanceRepository

  constructor(attendanceRepository: AttendanceRepository) {
    this.attendanceRepository = attendanceRepository
  }

  async execute(
    actor: User,
    request: {
      origin: AttendanceOrigin
      location?: GeoLocation
      permissionNote?: string
      environmentPhotoUrl?: string
      environmentPhotoPath?: string
      evidenceFile?: { data: Blob; contentType: string }
    },
  ): Promise<Attendance> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    if (!isAttendanceOrigin(request.origin)) {
      throw new ValidationError('El origen de asistencia no es válido')
    }
    if (request.origin === AttendanceOrigin.Permiso) {
      throw new ValidationError(
        'Solo un administrador puede registrar permisos. Contacta a tu supervisor.',
      )
    }

    const dateKey = toLimaDateKey()
    const existing = await this.attendanceRepository.getByUserAndDate(
      actor.id,
      dateKey,
    )
    if (existing) {
      throw new ValidationError('Ya tienes asistencia registrada hoy')
    }

    const location = request.location
    if (
      !location ||
      !isValidGeoLocation(location.latitude, location.longitude)
    ) {
      throw new ValidationError('Activa el GPS para marcar asistencia')
    }

    let distanceToOfficeMeters: number | undefined
    let officeValidated = false
    let areaId = ''
    let areaName = ''

    if (request.origin === AttendanceOrigin.Oficina) {
      const settings = normalizeAttendanceSettings(
        (await this.attendanceRepository.getSettings()) ??
          defaultAttendanceSettings(),
      )
      const match = findMatchingOfficePoint(
        location.latitude,
        location.longitude,
        settings,
      )
      if (!match) {
        const points = resolveOfficePoints(settings)
        const nearest = points
          .map((point) => ({
            point,
            distance: Math.round(
              distanceMeters(
                location.latitude,
                location.longitude,
                point.latitude,
                point.longitude,
              ),
            ),
          }))
          .sort((a, b) => a.distance - b.distance)[0]
        const hint = nearest
          ? ` Estás a ${nearest.distance} m de «${nearest.point.name}» (máx. ${nearest.point.radiusMeters} m).`
          : ''
        throw new ValidationError(
          `No estás dentro de ningún punto de oficina autorizado.${hint}`,
        )
      }
      distanceToOfficeMeters = match.distanceMeters
      officeValidated = true
      areaId = match.point.id
      areaName = match.point.name
    }

    let environmentPhotoUrl = request.environmentPhotoUrl?.trim() ?? ''
    let environmentPhotoPath = request.environmentPhotoPath?.trim() ?? ''

    if (request.evidenceFile) {
      if (
        request.evidenceFile.data.size <= 0 ||
        request.evidenceFile.data.size > 10 * 1024 * 1024
      ) {
        throw new ValidationError('La foto debe pesar máximo 10 MB')
      }
      const uploaded = await this.attendanceRepository.uploadEvidencePhoto({
        userId: actor.id,
        dateKey,
        data: request.evidenceFile.data,
        contentType: request.evidenceFile.contentType || 'image/jpeg',
      })
      environmentPhotoUrl = uploaded.url
      environmentPhotoPath = uploaded.path
    }

    if (
      (environmentPhotoUrl && !environmentPhotoPath) ||
      (!environmentPhotoUrl && environmentPhotoPath)
    ) {
      throw new ValidationError('La foto de evidencia está incompleta')
    }
    const hasPhoto = Boolean(environmentPhotoUrl && environmentPhotoPath)

    return this.attendanceRepository.create({
      userId: actor.id,
      userName: actor.displayName,
      dateKey,
      origin: request.origin,
      areaId,
      areaName,
      location,
      distanceToOfficeMeters,
      officeValidated,
      environmentPhotoUrl: hasPhoto ? environmentPhotoUrl : undefined,
      environmentPhotoPath: hasPhoto ? environmentPhotoPath : undefined,
    })
  }
}

export class GrantAttendancePermissionUseCase {
  private readonly attendanceRepository: AttendanceRepository
  private readonly userRepository: UserRepository

  constructor(
    attendanceRepository: AttendanceRepository,
    userRepository: UserRepository,
  ) {
    this.attendanceRepository = attendanceRepository
    this.userRepository = userRepository
  }

  async execute(
    actor: User,
    request: {
      targetUserId: string
      dateKey: string
      note?: string
    },
  ): Promise<Attendance> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede registrar un permiso',
      )
    }
    if (!isDateKey(request.dateKey)) {
      throw new ValidationError('La fecha no es válida')
    }
    if (request.dateKey > toLimaDateKey()) {
      throw new ValidationError('No se puede registrar permiso a futuro')
    }

    const target = await this.userRepository.getById(request.targetUserId)
    if (!target || !target.active) {
      throw new ValidationError('La persona no está activa o no existe')
    }

    const existing = await this.attendanceRepository.getByUserAndDate(
      target.id,
      request.dateKey,
    )
    if (existing) {
      throw new ValidationError(
        `${target.displayName} ya tiene asistencia o permiso ese día`,
      )
    }

    const note = trimPermissionNote(request.note)
    return this.attendanceRepository.create({
      userId: target.id,
      userName: target.displayName,
      dateKey: request.dateKey,
      origin: AttendanceOrigin.Permiso,
      areaId: '',
      areaName: '',
      location: PERMISO_LOCATION,
      officeValidated: false,
      permissionNote: note || undefined,
      markedById: actor.id,
      markedByName: actor.displayName,
    })
  }
}

function trimPermissionRequestDescription(description: string): string {
  return description.trim().slice(0, MAX_PERMISSION_DESCRIPTION)
}

export class RequestAttendancePermissionUseCase {
  private readonly requestRepository: AttendancePermissionRequestRepository

  constructor(requestRepository: AttendancePermissionRequestRepository) {
    this.requestRepository = requestRepository
  }

  async execute(
    actor: User,
    request: {
      description: string
      evidencePhotoUrl?: string
      evidencePhotoPath?: string
      evidenceFile?: { data: Blob; contentType: string }
    },
  ): Promise<AttendancePermissionRequest> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }

    const description = trimPermissionRequestDescription(request.description)
    if (description.length < MIN_PERMISSION_DESCRIPTION) {
      throw new ValidationError(
        `Describe el motivo del permiso (mínimo ${MIN_PERMISSION_DESCRIPTION} caracteres)`,
      )
    }

    let evidencePhotoUrl = request.evidencePhotoUrl?.trim() ?? ''
    let evidencePhotoPath = request.evidencePhotoPath?.trim() ?? ''

    if (request.evidenceFile) {
      if (
        request.evidenceFile.data.size <= 0 ||
        request.evidenceFile.data.size > 10 * 1024 * 1024
      ) {
        throw new ValidationError('La foto debe pesar máximo 10 MB')
      }
      const fileId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`
      const uploaded = await this.requestRepository.uploadEvidencePhoto({
        userId: actor.id,
        fileId,
        data: request.evidenceFile.data,
        contentType: request.evidenceFile.contentType || 'image/jpeg',
      })
      evidencePhotoUrl = uploaded.url
      evidencePhotoPath = uploaded.path
    }

    if (
      (evidencePhotoUrl && !evidencePhotoPath) ||
      (!evidencePhotoUrl && evidencePhotoPath)
    ) {
      throw new ValidationError('La foto adjunta está incompleta')
    }

    const pending = await this.requestRepository.listPendingByUser(actor.id)
    if (pending.length > 0) {
      throw new ValidationError(
        'Ya tienes una solicitud de permiso pendiente. Espera la respuesta del administrador.',
      )
    }

    return this.requestRepository.create({
      userId: actor.id,
      userName: actor.displayName,
      description,
      evidencePhotoUrl: evidencePhotoUrl || undefined,
      evidencePhotoPath: evidencePhotoPath || undefined,
    })
  }
}

export class ListMyAttendancePermissionRequestsUseCase {
  private readonly requestRepository: AttendancePermissionRequestRepository

  constructor(requestRepository: AttendancePermissionRequestRepository) {
    this.requestRepository = requestRepository
  }

  async execute(actor: User): Promise<AttendancePermissionRequest[]> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    return this.requestRepository.listByUser(actor.id)
  }
}

export class ListPendingAttendancePermissionRequestsUseCase {
  private readonly requestRepository: AttendancePermissionRequestRepository

  constructor(requestRepository: AttendancePermissionRequestRepository) {
    this.requestRepository = requestRepository
  }

  async execute(actor: User): Promise<AttendancePermissionRequest[]> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede ver las solicitudes de permiso',
      )
    }
    return this.requestRepository.listPending()
  }
}

export class ApproveAttendancePermissionRequestUseCase {
  private readonly requestRepository: AttendancePermissionRequestRepository
  private readonly attendanceRepository: AttendanceRepository

  constructor(
    requestRepository: AttendancePermissionRequestRepository,
    attendanceRepository: AttendanceRepository,
  ) {
    this.requestRepository = requestRepository
    this.attendanceRepository = attendanceRepository
  }

  async execute(
    actor: User,
    input: {
      requestId: string
      leaveDays: number
      startDateKey: string
      adminNote?: string
    },
  ): Promise<AttendancePermissionRequest> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede aprobar solicitudes de permiso',
      )
    }

    const leaveDays = Math.round(input.leaveDays)
    if (
      !Number.isFinite(leaveDays) ||
      leaveDays < MIN_LEAVE_DAYS ||
      leaveDays > MAX_LEAVE_DAYS
    ) {
      throw new ValidationError(
        `Los días de permiso deben estar entre ${MIN_LEAVE_DAYS} y ${MAX_LEAVE_DAYS}`,
      )
    }
    if (!isDateKey(input.startDateKey)) {
      throw new ValidationError('La fecha de inicio no es válida')
    }

    const existing = await this.requestRepository.getById(input.requestId)
    if (!existing) {
      throw new ValidationError('La solicitud no existe')
    }
    if (existing.status !== AttendancePermissionRequestStatus.Pending) {
      throw new ValidationError('Esta solicitud ya fue atendida')
    }

    const dateKeys = addLimaDateKeys(input.startDateKey, leaveDays)
    const endDateKey = dateKeys[dateKeys.length - 1] ?? input.startDateKey

    for (const dateKey of dateKeys) {
      const attendance = await this.attendanceRepository.getByUserAndDate(
        existing.userId,
        dateKey,
      )
      if (attendance) {
        throw new ValidationError(
          `${existing.userName} ya tiene asistencia o permiso el ${dateKey}`,
        )
      }
    }

    const noteParts = [
      existing.description,
      input.adminNote?.trim() ? `Admin: ${input.adminNote.trim()}` : '',
    ].filter(Boolean)
    const permissionNote = noteParts.join(' · ').slice(0, 200)

    const attendances = dateKeys.map((dateKey) => ({
      userId: existing.userId,
      userName: existing.userName,
      dateKey,
      origin: AttendanceOrigin.Permiso,
      areaId: '',
      areaName: '',
      location: PERMISO_LOCATION,
      officeValidated: false,
      permissionNote: permissionNote || undefined,
      markedById: actor.id,
      markedByName: actor.displayName,
    }))

    await this.attendanceRepository.createManyAndApproveRequest(attendances, {
      requestId: existing.id,
      leaveDays,
      startDateKey: input.startDateKey,
      endDateKey,
      adminNote: input.adminNote?.trim().slice(0, 200) || undefined,
      reviewedById: actor.id,
      reviewedByName: actor.displayName,
    })

    const approved = await this.requestRepository.getById(existing.id)
    if (!approved) {
      throw new ValidationError('No se pudo confirmar la aprobación del permiso')
    }
    return approved
  }
}

export class RejectAttendancePermissionRequestUseCase {
  private readonly requestRepository: AttendancePermissionRequestRepository

  constructor(requestRepository: AttendancePermissionRequestRepository) {
    this.requestRepository = requestRepository
  }

  async execute(
    actor: User,
    input: { requestId: string; adminNote?: string },
  ): Promise<AttendancePermissionRequest> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede rechazar solicitudes de permiso',
      )
    }

    const existing = await this.requestRepository.getById(input.requestId)
    if (!existing) {
      throw new ValidationError('La solicitud no existe')
    }
    if (existing.status !== AttendancePermissionRequestStatus.Pending) {
      throw new ValidationError('Esta solicitud ya fue atendida')
    }

    return this.requestRepository.reject({
      requestId: existing.id,
      adminNote: input.adminNote?.trim().slice(0, 200) || undefined,
      reviewedById: actor.id,
      reviewedByName: actor.displayName,
    })
  }
}
