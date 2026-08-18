class MobileAppRelease {
  const MobileAppRelease({
    required this.versionName,
    required this.versionCode,
    required this.apkUrl,
    required this.notes,
    required this.forceUpdate,
  });

  final String versionName;
  final int versionCode;
  final String apkUrl;
  final String notes;
  final bool forceUpdate;

  bool isNewerThan(int installedVersionCode) =>
      versionCode > installedVersionCode;
}
