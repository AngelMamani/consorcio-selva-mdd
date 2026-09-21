/** Configuración compartida de la Canon / bridge en la oficina (Firestore). */

export type OfficeScanDriver = 'wia' | 'twain'
export type OfficeScanSource = 'feeder' | 'glass' | 'duplex'

export interface OfficeDeviceSettings {
  bridgeBaseUrl: string
  printerIp: string
  printerPort: number
  twainDriverName: string
  scanDriver: OfficeScanDriver
  scanSource: OfficeScanSource
  updatedAt: Date | null
  updatedById: string | null
  updatedByName: string | null
}

export const DEFAULT_OFFICE_DEVICE_SETTINGS: Omit<
  OfficeDeviceSettings,
  'updatedAt' | 'updatedById' | 'updatedByName'
> = {
  bridgeBaseUrl: 'http://localhost:5000',
  printerIp: '192.168.0.121',
  printerPort: 9100,
  twainDriverName: 'Color Network ScanGear 2',
  scanDriver: 'wia',
  scanSource: 'feeder',
}

export function defaultOfficeDeviceSettings(): OfficeDeviceSettings {
  return {
    ...DEFAULT_OFFICE_DEVICE_SETTINGS,
    updatedAt: null,
    updatedById: null,
    updatedByName: null,
  }
}

function cleanBridgeUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/$/, '')
  if (!value) return DEFAULT_OFFICE_DEVICE_SETTINGS.bridgeBaseUrl
  return value
}

function cleanPrinterIp(raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return DEFAULT_OFFICE_DEVICE_SETTINGS.printerIp
  return value.slice(0, 64)
}

function cleanPort(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    return DEFAULT_OFFICE_DEVICE_SETTINGS.printerPort
  }
  return Math.floor(n)
}

function cleanDriverName(raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return DEFAULT_OFFICE_DEVICE_SETTINGS.twainDriverName
  return value.slice(0, 120)
}

export function normalizeOfficeDeviceSettings(
  raw: Partial<OfficeDeviceSettings> | null | undefined,
): OfficeDeviceSettings {
  const scanDriver =
    raw?.scanDriver === 'twain' || raw?.scanDriver === 'wia'
      ? raw.scanDriver
      : DEFAULT_OFFICE_DEVICE_SETTINGS.scanDriver
  const scanSource =
    raw?.scanSource === 'glass' ||
    raw?.scanSource === 'duplex' ||
    raw?.scanSource === 'feeder'
      ? raw.scanSource
      : DEFAULT_OFFICE_DEVICE_SETTINGS.scanSource

  return {
    bridgeBaseUrl: cleanBridgeUrl(raw?.bridgeBaseUrl),
    printerIp: cleanPrinterIp(raw?.printerIp),
    printerPort: cleanPort(raw?.printerPort),
    twainDriverName: cleanDriverName(raw?.twainDriverName),
    scanDriver,
    scanSource,
    updatedAt: raw?.updatedAt instanceof Date ? raw.updatedAt : null,
    updatedById:
      typeof raw?.updatedById === 'string' && raw.updatedById.trim()
        ? raw.updatedById.trim()
        : null,
    updatedByName:
      typeof raw?.updatedByName === 'string' && raw.updatedByName.trim()
        ? raw.updatedByName.trim().slice(0, 120)
        : null,
  }
}

export function officeDeviceSettingsToLocalConfig(
  settings: OfficeDeviceSettings,
): {
  bridgeBaseUrl: string
  printerIp: string
  printerPort: number
  twainDriverName: string
  scanDriver: OfficeScanDriver
  scanSource: OfficeScanSource
} {
  return {
    bridgeBaseUrl: settings.bridgeBaseUrl,
    printerIp: settings.printerIp,
    printerPort: settings.printerPort,
    twainDriverName: settings.twainDriverName,
    scanDriver: settings.scanDriver,
    scanSource: settings.scanSource,
  }
}
