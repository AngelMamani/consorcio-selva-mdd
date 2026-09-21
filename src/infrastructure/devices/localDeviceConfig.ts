/** Configuración del equipo local (impresora/escáner Canon en la red de la oficina). */

export type LocalDeviceConfig = {
  /** URL del bridge en el PC de la oficina (no es Vercel). */
  bridgeBaseUrl: string
  /** IP de la Canon / MFP en la LAN. */
  printerIp: string
  /** Puerto RAW (PJL/PDF directo). */
  printerPort: number
  /** Nombre del dispositivo (WIA/TWAIN), igual que en Windows Escáner. */
  twainDriverName: string
  /** wia = como app Escáner de Windows; twain = ScanGear clásico. */
  scanDriver: 'wia' | 'twain'
  /** feeder = alimentador; glass = plano. */
  scanSource: 'feeder' | 'glass' | 'duplex'
}

export const DEFAULT_LOCAL_DEVICE_CONFIG: LocalDeviceConfig = {
  bridgeBaseUrl: 'http://localhost:5000',
  printerIp: '192.168.0.121',
  printerPort: 9100,
  twainDriverName: 'Color Network ScanGear 2',
  scanDriver: 'wia',
  scanSource: 'feeder',
}

const STORAGE_KEY = 'consorcio-local-device-config'

export function loadLocalDeviceConfig(): LocalDeviceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LOCAL_DEVICE_CONFIG }
    const parsed = JSON.parse(raw) as Partial<LocalDeviceConfig>
    return {
      bridgeBaseUrl:
        typeof parsed.bridgeBaseUrl === 'string' && parsed.bridgeBaseUrl.trim()
          ? parsed.bridgeBaseUrl.trim().replace(/\/$/, '')
          : DEFAULT_LOCAL_DEVICE_CONFIG.bridgeBaseUrl,
      printerIp:
        typeof parsed.printerIp === 'string' && parsed.printerIp.trim()
          ? parsed.printerIp.trim()
          : DEFAULT_LOCAL_DEVICE_CONFIG.printerIp,
      printerPort:
        Number.isFinite(Number(parsed.printerPort)) && Number(parsed.printerPort) > 0
          ? Math.floor(Number(parsed.printerPort))
          : DEFAULT_LOCAL_DEVICE_CONFIG.printerPort,
      twainDriverName:
        typeof parsed.twainDriverName === 'string' && parsed.twainDriverName.trim()
          ? parsed.twainDriverName.trim()
          : DEFAULT_LOCAL_DEVICE_CONFIG.twainDriverName,
      scanDriver:
        parsed.scanDriver === 'twain' || parsed.scanDriver === 'wia'
          ? parsed.scanDriver
          : DEFAULT_LOCAL_DEVICE_CONFIG.scanDriver,
      scanSource:
        parsed.scanSource === 'glass' ||
        parsed.scanSource === 'duplex' ||
        parsed.scanSource === 'feeder'
          ? parsed.scanSource
          : DEFAULT_LOCAL_DEVICE_CONFIG.scanSource,
    }
  } catch {
    return { ...DEFAULT_LOCAL_DEVICE_CONFIG }
  }
}

export function saveLocalDeviceConfig(config: LocalDeviceConfig): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      bridgeBaseUrl: config.bridgeBaseUrl.trim().replace(/\/$/, ''),
      printerIp: config.printerIp.trim(),
      printerPort: Math.floor(config.printerPort),
      twainDriverName: config.twainDriverName.trim(),
      scanDriver: config.scanDriver,
      scanSource: config.scanSource,
    }),
  )
}
