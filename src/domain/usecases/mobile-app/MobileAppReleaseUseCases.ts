import type { MobileAppRelease } from '@/domain/entities/MobileAppRelease'
import type { User } from '@/domain/entities/User'
import { assertUserCanManageUsers } from '@/domain/entities/User'
import type { MobileAppReleaseRepository } from '@/domain/repositories/MobileAppReleaseRepository'
import {
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors/DomainError'

const MAX_APK_BYTES = 90 * 1024 * 1024

function parseVersionName(raw: string): string {
  const value = raw.trim()
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new ValidationError('La versión debe verse como 1.2.2')
  }
  return value
}

export class GetMobileAppReleaseUseCase {
  private readonly repository: MobileAppReleaseRepository

  constructor(repository: MobileAppReleaseRepository) {
    this.repository = repository
  }

  async execute(actor: User): Promise<MobileAppRelease | null> {
    if (!actor.active) {
      throw new UnauthorizedError('Cuenta inactiva')
    }
    return this.repository.getRelease()
  }
}

export class PublishMobileAppReleaseUseCase {
  private readonly repository: MobileAppReleaseRepository

  constructor(repository: MobileAppReleaseRepository) {
    this.repository = repository
  }

  async execute(
    actor: User,
    input: {
      versionName: string
      versionCode: number
      notes: string
      forceUpdate: boolean
      apkFileName: string
      apkContentType: string
      apkBytes: Uint8Array
      onProgress?: (ratio: number) => void
    },
  ): Promise<MobileAppRelease> {
    if (!assertUserCanManageUsers(actor)) {
      throw new UnauthorizedError(
        'Solo el administrador puede publicar la app de técnicos',
      )
    }

    const versionName = parseVersionName(input.versionName)
    const versionCode = Math.round(input.versionCode)
    if (!Number.isInteger(versionCode) || versionCode < 1) {
      throw new ValidationError('El código de versión debe ser un entero mayor a 0')
    }

    const current = await this.repository.getRelease()
    if (current && versionCode <= current.versionCode) {
      throw new ValidationError(
        `El código debe ser mayor que ${current.versionCode} (el que ya está publicado)`,
      )
    }

    if (input.apkBytes.byteLength <= 0 || input.apkBytes.byteLength > MAX_APK_BYTES) {
      throw new ValidationError('El APK es obligatorio y debe pesar máximo 90 MB')
    }

    const fileName = input.apkFileName.trim().toLowerCase()
    if (!fileName.endsWith('.apk')) {
      throw new ValidationError('Sube un archivo .apk')
    }

    return this.repository.publishRelease({
      versionName,
      versionCode,
      notes: input.notes.trim().slice(0, 500),
      forceUpdate: input.forceUpdate,
      apkFileName: input.apkFileName,
      apkContentType: input.apkContentType || 'application/vnd.android.package-archive',
      apkBytes: input.apkBytes,
      updatedById: actor.id,
      updatedByName: actor.displayName,
      onProgress: input.onProgress,
    })
  }
}
