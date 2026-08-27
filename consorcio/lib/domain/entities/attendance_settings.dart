class AttendanceSettings {
  const AttendanceSettings({
    required this.officeName,
    required this.officeLatitude,
    required this.officeLongitude,
    required this.officeRadiusMeters,
  });

  final String officeName;
  final double officeLatitude;
  final double officeLongitude;
  final int officeRadiusMeters;

  static const defaults = AttendanceSettings(
    officeName: 'Oficina Consorcio Selva MDD',
    officeLatitude: -12.59331,
    officeLongitude: -69.18915,
    officeRadiusMeters: 30,
  );

  static int normalizeRadius(int meters) {
    if (meters < 10 || meters > 80) return 30;
    return meters;
  }
}
