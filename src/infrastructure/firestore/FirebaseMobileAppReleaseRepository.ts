import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage'
import type { MobileAppRelease } from '@/domain/entities/MobileAppRelease'
import type {
  MobileAppReleaseRepository,
  PublishMobileAppReleaseInput,
} from '@/domain/repositories/MobileAppReleaseRepository'
import { firestoreDb } from '@/infrastructure/firebase/firebaseApp'
import { firebaseStorage } from '@/infrastructure/firebase/firebaseApp'

const SETTINGS_ID = 'mobileApp'
const APK_PATH = 'app-releases/consorcio-tecnico.apk'

interface MobileAppDoc {
  versionName: string
  versionCode: number
  apkUrl: string
  apkPath: string
  notes: string
  forceUpdate: boolean
  updatedAt: Timestamp
  updatedById: string
  updatedByName: string
}

function mapRelease(data: MobileAppDoc): MobileAppRelease {
  return {
    versionName: data.versionName,
    versionCode: data.versionCode,
    apkUrl: data.apkUrl,
    apkPath: data.apkPath,
    notes: data.notes ?? '',
    forceUpdate: data.forceUpdate === true,
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    updatedById: data.updatedById,
    updatedByName: data.updatedByName,
  }
}

export class FirebaseMobileAppReleaseRepository
  implements MobileAppReleaseRepository
{
  private readonly settingsRef = doc(firestoreDb, 'settings', SETTINGS_ID)

  async getRelease(): Promise<MobileAppRelease | null> {
    const snapshot = await getDoc(this.settingsRef)
    if (!snapshot.exists()) return null
    return mapRelease(snapshot.data() as MobileAppDoc)
  }

  async publishRelease(
    input: PublishMobileAppReleaseInput,
  ): Promise<MobileAppRelease> {
    const storageRef = ref(firebaseStorage, APK_PATH)
    const contentType = input.apkContentType.includes('android')
      ? input.apkContentType
      : 'application/vnd.android.package-archive'

    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, input.apkBytes, {
        contentType,
      })
      task.on(
        'state_changed',
        (snapshot) => {
          if (!input.onProgress || snapshot.totalBytes <= 0) return
          input.onProgress(snapshot.bytesTransferred / snapshot.totalBytes)
        },
        reject,
        () => resolve(),
      )
    })

    const apkUrl = await getDownloadURL(storageRef)
    const now = Timestamp.now()
    const payload: MobileAppDoc = {
      versionName: input.versionName,
      versionCode: input.versionCode,
      apkUrl,
      apkPath: APK_PATH,
      notes: input.notes,
      forceUpdate: input.forceUpdate,
      updatedAt: now,
      updatedById: input.updatedById,
      updatedByName: input.updatedByName,
    }
    await setDoc(this.settingsRef, payload)
    return mapRelease(payload)
  }
}
