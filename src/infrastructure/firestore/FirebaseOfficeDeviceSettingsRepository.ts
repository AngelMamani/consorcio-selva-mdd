import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import type { OfficeDeviceSettings } from '@/domain/entities/OfficeDeviceSettings'
import {
  normalizeOfficeDeviceSettings,
} from '@/domain/entities/OfficeDeviceSettings'
import type {
  OfficeDeviceSettingsRepository,
  SaveOfficeDeviceSettingsInput,
} from '@/domain/repositories/OfficeDeviceSettingsRepository'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'

const SETTINGS_ID = 'officeDevices'

interface OfficeDevicesDoc {
  bridgeBaseUrl: string
  printerIp: string
  printerPort: number
  twainDriverName: string
  scanDriver: 'wia' | 'twain'
  scanSource: 'feeder' | 'glass' | 'duplex'
  updatedAt: Timestamp
  updatedById: string
  updatedByName: string
}

function mapDoc(data: OfficeDevicesDoc): OfficeDeviceSettings {
  return normalizeOfficeDeviceSettings({
    bridgeBaseUrl: data.bridgeBaseUrl,
    printerIp: data.printerIp,
    printerPort: data.printerPort,
    twainDriverName: data.twainDriverName,
    scanDriver: data.scanDriver,
    scanSource: data.scanSource,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
    updatedById: data.updatedById,
    updatedByName: data.updatedByName,
  })
}

export class FirebaseOfficeDeviceSettingsRepository
  implements OfficeDeviceSettingsRepository
{
  private readonly settingsRef = doc(firestoreDb, 'settings', SETTINGS_ID)

  async get(): Promise<OfficeDeviceSettings | null> {
    const snapshot = await getDoc(this.settingsRef)
    if (!snapshot.exists()) return null
    return mapDoc(snapshot.data() as OfficeDevicesDoc)
  }

  async save(
    input: SaveOfficeDeviceSettingsInput,
  ): Promise<OfficeDeviceSettings> {
    const now = Timestamp.now()
    const payload: OfficeDevicesDoc = {
      bridgeBaseUrl: input.bridgeBaseUrl,
      printerIp: input.printerIp,
      printerPort: input.printerPort,
      twainDriverName: input.twainDriverName,
      scanDriver: input.scanDriver,
      scanSource: input.scanSource,
      updatedAt: now,
      updatedById: input.updatedById,
      updatedByName: input.updatedByName,
    }
    await setDoc(this.settingsRef, payload)
    return mapDoc(payload)
  }
}
