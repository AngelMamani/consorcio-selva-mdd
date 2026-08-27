import type { Attendance } from '@/domain/entities/Attendance'
import {
  AttendanceOrigin,
  isAttendanceOrigin,
  toLimaDateKey,
} from '@/domain/entities/Attendance'
import type { AttendanceSettings } from '@/domain/entities/AttendanceSettings'
import {
  defaultAttendanceSettings,
  MAX_OFFICE_RADIUS_METERS,
  MIN_OFFICE_RADIUS_METERS,
  normalizeOfficeRadiusMeters,
} from '@/domain/entities/AttendanceSettings'
import type { User } from '@/domain/entities/User'
import {
  assertUserCanManageUsers,
  uniqueUsersByAccessDni,
} from '@/domain/entities/User'
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
    const resolved = settings ?? defaultAttendanceSettings()
    return {
      ...resolved,
      officeRadiusMeters: normalizeOfficeRadiusMeters(resolved.officeRadiusMeters),
    }
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
      officeName: string
      officeLatitude: number
      officeLongitude: number
      officeRadiusMeters: number
    },
  ): Promise<AttendanceSettings> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede configurar la oficina',
      )
    }

    const officeName = input.officeName.trim()
    if (!officeName) {
      throw new ValidationError('El nombre de la oficina es obligatorio')
    }
    if (officeName.length > 120) {
      throw new ValidationError('El nombre no debe superar 120 caracteres')
    }
    if (!isValidGeoLocation(input.officeLatitude, input.officeLongitude)) {
      throw new ValidationError('La ubicación de la oficina no es válida')
    }
    const radius = normalizeOfficeRadiusMeters(input.officeRadiusMeters)
    if (
      Math.round(input.officeRadiusMeters) < MIN_OFFICE_RADIUS_METERS ||
      Math.round(input.officeRadiusMeters) > MAX_OFFICE_RADIUS_METERS
    ) {
      throw new ValidationError(
        `El radio debe estar entre ${MIN_OFFICE_RADIUS_METERS} y ${MAX_OFFICE_RADIUS_METERS} metros`,
      )
    }

    return this.attendanceRepository.saveSettings({
      officeName,
      officeLatitude: input.officeLatitude,
      officeLongitude: input.officeLongitude,
      officeRadiusMeters: radius,
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
    },
  ): Promise<Attendance> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    if (!isAttendanceOrigin(request.origin)) {
      throw new ValidationError('El origen de asistencia no es válido')
    }

    const environmentPhotoUrl = request.environmentPhotoUrl?.trim() ?? ''
    const environmentPhotoPath = request.environmentPhotoPath?.trim() ?? ''
    if (
      (environmentPhotoUrl && !environmentPhotoPath) ||
      (!environmentPhotoUrl && environmentPhotoPath)
    ) {
      throw new ValidationError('La foto de evidencia está incompleta')
    }
    const hasPhoto = Boolean(environmentPhotoUrl && environmentPhotoPath)
    if (request.origin === AttendanceOrigin.Permiso && hasPhoto) {
      throw new ValidationError('El permiso no lleva foto')
    }

    const dateKey = toLimaDateKey()
    const existing = await this.attendanceRepository.getByUserAndDate(
      actor.id,
      dateKey,
    )
    if (existing) {
      throw new ValidationError('Ya tienes asistencia o permiso registrado hoy')
    }

    if (request.origin === AttendanceOrigin.Permiso) {
      const note = trimPermissionNote(request.permissionNote)
      return this.attendanceRepository.create({
        userId: actor.id,
        userName: actor.displayName,
        dateKey,
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

    const location = request.location
    if (
      !location ||
      !isValidGeoLocation(location.latitude, location.longitude)
    ) {
      throw new ValidationError('Activa el GPS para marcar asistencia')
    }

    let distanceToOfficeMeters: number | undefined
    let officeValidated = false

    if (request.origin === AttendanceOrigin.Oficina) {
      const settings =
        (await this.attendanceRepository.getSettings()) ??
        defaultAttendanceSettings()
      distanceToOfficeMeters = Math.round(
        distanceMeters(
          location.latitude,
          location.longitude,
          settings.officeLatitude,
          settings.officeLongitude,
        ),
      )
      if (distanceToOfficeMeters > settings.officeRadiusMeters) {
        throw new ValidationError(
          `Estás a ${distanceToOfficeMeters} m de ${settings.officeName}. Acércate a menos de ${settings.officeRadiusMeters} m para marcar en oficina.`,
        )
      }
      officeValidated = true
    }

    return this.attendanceRepository.create({
      userId: actor.id,
      userName: actor.displayName,
      dateKey,
      origin: request.origin,
      areaId: '',
      areaName: '',
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
