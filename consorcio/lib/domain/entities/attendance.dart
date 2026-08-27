import '../value_objects/geo_location.dart';

enum AttendanceOrigin {
  oficina,
  zona,
  permiso;

  String get firestoreValue {
    switch (this) {
      case AttendanceOrigin.oficina:
        return 'OFICINA';
      case AttendanceOrigin.zona:
        return 'ZONA';
      case AttendanceOrigin.permiso:
        return 'PERMISO';
    }
  }

  String get label {
    switch (this) {
      case AttendanceOrigin.oficina:
        return 'Oficina';
      case AttendanceOrigin.zona:
        return 'Campo';
      case AttendanceOrigin.permiso:
        return 'Permiso';
    }
  }

  static AttendanceOrigin fromString(String value) {
    if (value == 'ZONA') return AttendanceOrigin.zona;
    if (value == 'PERMISO') return AttendanceOrigin.permiso;
    return AttendanceOrigin.oficina;
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
    this.permissionNote,
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
  final String? permissionNote;
}

String limaDateKey([DateTime? now]) {
  final utc = (now ?? DateTime.now()).toUtc();
  final lima = utc.subtract(const Duration(hours: 5));
  final month = lima.month.toString().padLeft(2, '0');
  final day = lima.day.toString().padLeft(2, '0');
  return '${lima.year}-$month-$day';
}

String attendanceDocId(String userId, String dateKey) => '${userId}_$dateKey';
