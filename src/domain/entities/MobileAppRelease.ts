export interface MobileAppRelease {
  versionName: string
  versionCode: number
  apkUrl: string
  apkPath: string
  notes: string
  forceUpdate: boolean
  updatedAt: Date
  updatedById: string
  updatedByName: string
}

export function isNewerAppRelease(
  remoteVersionCode: number,
  installedVersionCode: number,
): boolean {
  return remoteVersionCode > installedVersionCode
}
