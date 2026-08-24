import { parseApkMeta, ApkParseError } from 'apk-meta-parser'

export interface ApkReleaseVersion {
  versionName: string
  versionCode: number
  packageName: string
}

function normalizeVersionName(raw: string): string {
  const match = raw.trim().match(/^(\d+\.\d+\.\d+)/)
  if (!match) {
    throw new Error(
      `El APK tiene versión “${raw}”. Debe verse como 1.3.0`,
    )
  }
  return match[1]
}

export async function readApkReleaseVersion(
  file: File,
): Promise<ApkReleaseVersion> {
  try {
    const meta = await parseApkMeta(file, { skipMd5: true, locale: 'en' })
    const versionCode = Number(meta.versionCode)
    if (!Number.isInteger(versionCode) || versionCode < 1) {
      throw new Error('El APK no trae un código de versión válido')
    }
    return {
      versionName: normalizeVersionName(meta.versionName || ''),
      versionCode,
      packageName: meta.packageName || '',
    }
  } catch (error) {
    if (error instanceof ApkParseError) {
      throw new Error(
        'No se pudo leer la versión del APK. Genera de nuevo el release.',
      )
    }
    throw error
  }
}
