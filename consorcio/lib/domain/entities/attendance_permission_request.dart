class AttendancePermissionRequestStatus {
  static const pending = 'PENDING';
  static const approved = 'APPROVED';
  static const rejected = 'REJECTED';

  static String label(String status) {
    switch (status) {
      case approved:
        return 'Aprobado';
      case rejected:
        return 'Rechazado';
      default:
        return 'Pendiente';
    }
  }
}

class AttendancePermissionRequest {
  const AttendancePermissionRequest({
    required this.id,
    required this.userId,
    required this.userName,
    required this.description,
    required this.status,
    required this.createdAt,
    this.evidencePhotoUrl,
    this.leaveDays,
    this.startDateKey,
    this.endDateKey,
    this.adminNote,
  });

  final String id;
  final String userId;
  final String userName;
  final String description;
  final String status;
  final DateTime createdAt;
  final String? evidencePhotoUrl;
  final int? leaveDays;
  final String? startDateKey;
  final String? endDateKey;
  final String? adminNote;
}
