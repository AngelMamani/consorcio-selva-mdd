import { DomainError } from '@/domain/errors/DomainError'
import {
  loadLocalDeviceConfig,
  type LocalDeviceConfig,
} from '@/infrastructure/devices/localDeviceConfig'

export type BridgeHealth = {
  ok: boolean
  printerIp: string
  printerPort: number
  twainDriverName: string
  scanMode: string
  message?: string
}

export type BridgeScanFile = {
  fileName: string
  mimeType: string
  /** Base64 sin prefijo data: */
  base64: string
}

function bridgeUrl(config: LocalDeviceConfig, path: string): string {
  return `${config.bridgeBaseUrl.replace(/\/$/, '')}${path}`
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string }
    return data.error || data.message || response.statusText
  } catch {
    return response.statusText || `HTTP ${response.status}`
  }
}

/** Comprueba si el bridge local está corriendo en el PC. */
export async function checkLocalDeviceBridge(
  config: LocalDeviceConfig = loadLocalDeviceConfig(),
): Promise<BridgeHealth> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(bridgeUrl(config, '/api/health'), {
      method: 'GET',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new DomainError(await readErrorMessage(response))
    }
    return (await response.json()) as BridgeHealth
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw new DomainError(
      `No se pudo conectar al bridge local (${config.bridgeBaseUrl}). Ábrelo en el PC de la oficina (npm run device-bridge).`,
    )
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * Pide un escaneo al bridge (TWAIN / NAPS2 / carpeta inbox).
 * Devuelve archivos listos para el flujo de separación de PDFs.
 */
export async function requestLocalScan(options?: {
  config?: LocalDeviceConfig
  /** Cantidad de hojas a escanear (si el bridge lo soporta). */
  pageCount?: number
}): Promise<File[]> {
  const config = options?.config ?? loadLocalDeviceConfig()
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 120_000)
  try {
    const response = await fetch(bridgeUrl(config, '/api/scan'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        twainDriverName: config.twainDriverName,
        device: config.twainDriverName,
        driver: config.scanDriver,
        source: config.scanSource,
        printerIp: config.printerIp,
        pageCount: options?.pageCount ?? 1,
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new DomainError(await readErrorMessage(response))
    }
    const data = (await response.json()) as {
      files?: BridgeScanFile[]
      error?: string
    }
    if (!data.files?.length) {
      throw new DomainError(
        data.error ||
          'El bridge no devolvió páginas. Revisa el escáner o la carpeta inbox.',
      )
    }
    return data.files.map((item, index) => {
      const binary = atob(item.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      const name =
        item.fileName?.trim() ||
        `escaneo-${Date.now()}-${index + 1}.${
          item.mimeType.includes('pdf') ? 'pdf' : 'jpg'
        }`
      return new File([bytes], name, {
        type: item.mimeType || 'image/jpeg',
      })
    })
  } catch (error) {
    if (error instanceof DomainError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DomainError('El escaneo tardó demasiado. Inténtalo de nuevo.')
    }
    throw new DomainError(
      `Error al escanear vía bridge (${config.bridgeBaseUrl}). ¿Está corriendo en este PC?`,
    )
  } finally {
    window.clearTimeout(timer)
  }
}

/** Envía un PDF/bytes a la impresora por RAW :9100 a través del bridge. */
export async function printViaLocalBridge(
  file: Blob,
  fileName: string,
  config: LocalDeviceConfig = loadLocalDeviceConfig(),
): Promise<void> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)

  const response = await fetch(bridgeUrl(config, '/api/print'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      printerIp: config.printerIp,
      printerPort: config.printerPort,
      fileName,
      mimeType: file.type || 'application/pdf',
      base64,
    }),
  })
  if (!response.ok) {
    throw new DomainError(await readErrorMessage(response))
  }
}
