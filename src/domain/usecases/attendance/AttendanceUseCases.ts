import type { Attendance } from '@/domain/entities/Attendance'
import {
  AttendanceOrigin,
  createOfficeQrToken,
  isAttendanceOrigin,
  limaDayUtcBounds,
  parseOfficeQrPayload,
  toLimaDateKey,
} from '@/domain/entities/Attendance'
import type { AttendanceOfficeQr } from '@/domain/entities/AttendanceOfficeQr'
import type { AttendanceSettings } from '@/domain/entities/AttendanceSettings'
import {
  defaultAttendanceSettings,
  MAX_OFFICE_RADIUS_METERS,
  MIN_OFFICE_RADIUS_METERS,
  normalizeOfficeRadiusMeters,
} from '@/domain/entities/AttendanceSettings'
import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
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
  technician: User
  attendance: Attendance | null
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

    if (actor.role !== UserRole.Administrador) {
      const own = await this.attendanceRepository.getByUserAndDate(
        actor.id,
        dateKey,
      )
      return [{ technician: actor, attendance: own }]
    }

    const [technicians, attendances] = await Promise.all([
      this.userRepository.listTechnicians(),
      this.attendanceRepository.listByDate(dateKey),
    ])

    const byUser = new Map(attendances.map((item) => [item.userId, item]))
    return technicians
      .filter((user) => user.role === UserRole.Tecnico && user.active)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
      .map((technician) => ({
        technician,
        attendance: byUser.get(technician.id) ?? null,
      }))
  }
}

export class GetOrCreateTodayOfficeQrUseCase {
  private readonly attendanceRepository: AttendanceRepository

  constructor(attendanceRepository: AttendanceRepository) {
    this.attendanceRepository = attendanceRepository
  }

  async execute(actor: User): Promise<AttendanceOfficeQr> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede mostrar el QR de oficina',
      )
    }
    const dateKey = toLimaDateKey()
    const existing = await this.attendanceRepository.getOfficeQr(dateKey)
    if (existing && existing.validUntil.getTime() > Date.now()) {
      return existing
    }
    const bounds = limaDayUtcBounds(dateKey)
    return this.attendanceRepository.saveOfficeQr({
      dateKey,
      token: createOfficeQrToken(),
      validFrom: bounds.validFrom,
      validUntil: bounds.validUntil,
      createdById: actor.id,
    })
  }
}

export class RotateTodayOfficeQrUseCase {
  private readonly attendanceRepository: AttendanceRepository

  constructor(attendanceRepository: AttendanceRepository) {
    this.attendanceRepository = attendanceRepository
  }

  async execute(actor: User): Promise<AttendanceOfficeQr> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede renovar el QR de oficina',
      )
    }
    const dateKey = toLimaDateKey()
    const bounds = limaDayUtcBounds(dateKey)
    return this.attendanceRepository.saveOfficeQr({
      dateKey,
      token: createOfficeQrToken(),
      validFrom: bounds.validFrom,
      validUntil: bounds.validUntil,
      createdById: actor.id,
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
      location: GeoLocation
      officeQrPayload?: string
      environmentPhotoUrl?: string
      environmentPhotoPath?: string
    },
  ): Promise<Attendance> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    if (actor.role !== UserRole.Tecnico) {
      throw new UnauthorizedError('Solo los técnicos marcan asistencia')
    }
    if (!isAttendanceOrigin(request.origin)) {
      throw new ValidationError('El origen de asistencia no es válido')
    }
    if (
      !isValidGeoLocation(request.location.latitude, request.location.longitude)
    ) {
      throw new ValidationError('Activa el GPS para marcar asistencia')
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

    const dateKey = toLimaDateKey()
    const existing = await this.attendanceRepository.getByUserAndDate(
      actor.id,
      dateKey,
    )
    if (existing) {
      throw new ValidationError('Ya marcaste asistencia hoy')
    }

    let distanceToOfficeMeters: number | undefined
    let officeValidated = false
    let officeQrToken: string | undefined

    if (request.origin === AttendanceOrigin.Oficina) {
      const qr = parseOfficeQrPayload(request.officeQrPayload ?? '')
      if (!qr) {
        throw new ValidationError(
          'Escanea el QR de oficina de hoy. El código cambia cada día.',
        )
      }
      if (qr.dateKey !== dateKey) {
        throw new ValidationError(
          'Ese QR no es de hoy. Pide el código actualizado en oficina.',
        )
      }
      officeQrToken = qr.token

      const settings =
        (await this.attendanceRepository.getSettings()) ??
        defaultAttendanceSettings()
      distanceToOfficeMeters = Math.round(
        distanceMeters(
          request.location.latitude,
          request.location.longitude,
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
      location: request.location,
      distanceToOfficeMeters,
      officeValidated,
      officeQrToken,
      environmentPhotoUrl: hasPhoto ? environmentPhotoUrl : undefined,
      environmentPhotoPath: hasPhoto ? environmentPhotoPath : undefined,
    })
  }
}
