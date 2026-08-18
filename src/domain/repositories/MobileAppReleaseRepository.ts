import type { MobileAppRelease } from '@/domain/entities/MobileAppRelease'

export interface PublishMobileAppReleaseInput {
  versionName: string
  versionCode: number
  notes: string
  forceUpdate: boolean
  apkFileName: string
  apkContentType: string
  apkBytes: Uint8Array
  updatedById: string
  updatedByName: string
  onProgress?: (ratio: number) => void
}

export interface MobileAppReleaseRepository {
  getRelease(): Promise<MobileAppRelease | null>
  publishRelease(input: PublishMobileAppReleaseInput): Promise<MobileAppRelease>
}
