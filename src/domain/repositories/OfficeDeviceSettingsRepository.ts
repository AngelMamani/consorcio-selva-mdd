import type { OfficeDeviceSettings } from '@/domain/entities/OfficeDeviceSettings'

export interface SaveOfficeDeviceSettingsInput {
  bridgeBaseUrl: string
  printerIp: string
  printerPort: number
  twainDriverName: string
  scanDriver: 'wia' | 'twain'
  scanSource: 'feeder' | 'glass' | 'duplex'
  updatedById: string
  updatedByName: string
}

export interface OfficeDeviceSettingsRepository {
  get(): Promise<OfficeDeviceSettings | null>
  save(input: SaveOfficeDeviceSettingsInput): Promise<OfficeDeviceSettings>
}
