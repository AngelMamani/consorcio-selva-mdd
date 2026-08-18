import '../value_objects/geo_location.dart';

enum AttendanceOrigin {
  oficina,
  zona;

  String get firestoreValue =>
      this == AttendanceOrigin.oficina ? 'OFICINA' : 'ZONA';

  String get label =>
      this == AttendanceOrigin.oficina ? 'Oficina' : 'Zona de trabajo';

  static AttendanceOrigin fromString(String value) {
    return value == 'ZONA' ? AttendanceOrigin.zona : AttendanceOrigin.oficina;
  }
}

class Attendance {
  const Attendance({
    required this.id,
    required this.userId,
    required this.userName,
    required this.dateKey,
    required this.origin,
    required this.areaId,
    required this.areaName,
    required this.location,
    required this.officeValidated,
    required this.createdAt,
    this.distanceToOfficeMeters,
    this.environmentPhotoUrl,
  });

  final String id;
  final String userId;
  final String userName;
  final String dateKey;
  final AttendanceOrigin origin;
  final String areaId;
  final String areaName;
  final GeoLocation location;
  final bool officeValidated;
  final int? distanceToOfficeMeters;
  final DateTime createdAt;
  final String? environmentPhotoUrl;
}

String limaDateKey([DateTime? now]) {
  final utc = (now ?? DateTime.now()).toUtc();
  final lima = utc.subtract(const Duration(hours: 5));
  final month = lima.month.toString().padLeft(2, '0');
  final day = lima.day.toString().padLeft(2, '0');
  return '${lima.year}-$month-$day';
}

String attendanceDocId(String userId, String dateKey) => '${userId}_$dateKey';

const officeQrPrefix = 'CSMDD1';

class OfficeQrPayload {
  const OfficeQrPayload({required this.dateKey, required this.token});

  final String dateKey;
  final String token;
}

OfficeQrPayload? parseOfficeQrPayload(String raw) {
  final parts = raw.trim().split('|');
  if (parts.length != 3) return null;
  final prefix = parts[0];
  final dateKey = parts[1];
  final token = parts[2];
  if (prefix != officeQrPrefix || dateKey.isEmpty || token.isEmpty) {
    return null;
  }
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(dateKey)) return null;
  if (!RegExp(r'^[a-f0-9]{48}$').hasMatch(token)) return null;
  return OfficeQrPayload(dateKey: dateKey, token: token);
}
