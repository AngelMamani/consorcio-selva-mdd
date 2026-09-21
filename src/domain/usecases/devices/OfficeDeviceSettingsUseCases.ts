import type { OfficeDeviceSettings } from '@/domain/entities/OfficeDeviceSettings'
import {
  defaultOfficeDeviceSettings,
  normalizeOfficeDeviceSettings,
} from '@/domain/entities/OfficeDeviceSettings'
import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import type { OfficeDeviceSettingsRepository } from '@/domain/repositories/OfficeDeviceSettingsRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

function requireBridgeUrl(raw: string): string {
  const value = raw.trim().replace(/\/$/, '')
  if (!value) {
    throw new ValidationError('La URL del bridge es obligatoria')
  }
  if (value.length > 200) {
    throw new ValidationError('La URL del bridge es demasiado larga')
  }
  if (!/^https?:\/\//i.test(value)) {
    throw new ValidationError('La URL del bridge debe empezar con http:// o https://')
  }
  return value
}

function requirePrinterIp(raw: string): string {
  const value = raw.trim()
  if (!value) {
    throw new ValidationError('La IP de la impresora/escáner es obligatoria')
  }
  if (value.length > 64) {
    throw new ValidationError('La IP es demasiado larga')
  }
  return value
}

function requirePort(raw: number): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    throw new ValidationError('El puerto debe estar entre 1 y 65535')
  }
  return n
}

function requireDriverName(raw: string): string {
  const value = raw.trim()
  if (!value) {
    throw new ValidationError('El nombre del escáner es obligatorio')
  }
  if (value.length > 120) {
    throw new ValidationError('El nombre del escáner es demasiado largo')
  }
  return value
}

export class GetOfficeDeviceSettingsUseCase {
  private readonly repository: OfficeDeviceSettingsRepository

  constructor(repository: OfficeDeviceSettingsRepository) {
    this.repository = repository
  }

  async execute(actor: User): Promise<OfficeDeviceSettings> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    const stored = await this.repository.get()
    return normalizeOfficeDeviceSettings(
      stored ?? defaultOfficeDeviceSettings(),
    )
  }
}

export class SaveOfficeDeviceSettingsUseCase {
  private readonly repository: OfficeDeviceSettingsRepository

  constructor(repository: OfficeDeviceSettingsRepository) {
    this.repository = repository
  }

  async execute(
    actor: User,
    input: {
      bridgeBaseUrl: string
      printerIp: string
      printerPort: number
      twainDriverName: string
      scanDriver: 'wia' | 'twain'
      scanSource: 'feeder' | 'glass' | 'duplex'
    },
  ): Promise<OfficeDeviceSettings> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede guardar la config de oficina',
      )
    }

    const scanDriver =
      input.scanDriver === 'twain' || input.scanDriver === 'wia'
        ? input.scanDriver
        : null
    if (!scanDriver) {
      throw new ValidationError('Modo de escaneo inválido')
    }

    const scanSource =
      input.scanSource === 'glass' ||
      input.scanSource === 'duplex' ||
      input.scanSource === 'feeder'
        ? input.scanSource
        : null
    if (!scanSource) {
      throw new ValidationError('Origen del papel inválido')
    }

    return this.repository.save({
      bridgeBaseUrl: requireBridgeUrl(input.bridgeBaseUrl),
      printerIp: requirePrinterIp(input.printerIp),
      printerPort: requirePort(input.printerPort),
      twainDriverName: requireDriverName(input.twainDriverName),
      scanDriver,
      scanSource,
      updatedById: actor.id,
      updatedByName: actor.displayName,
    })
  }
}
