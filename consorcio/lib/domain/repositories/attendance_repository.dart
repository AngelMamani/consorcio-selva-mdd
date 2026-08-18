import '../entities/attendance.dart';
import '../entities/attendance_settings.dart';
import '../value_objects/geo_location.dart';
import 'folder_image_repository.dart';

abstract class AttendanceRepository {
  Future<AttendanceSettings> getSettings();
  Future<Attendance?> getByUserAndDate(String userId, String dateKey);
  Future<Attendance> create({
    required String userId,
    required String userName,
    required String dateKey,
    required AttendanceOrigin origin,
    required String areaId,
    required String areaName,
    required GeoLocation location,
    required bool officeValidated,
    int? distanceToOfficeMeters,
    String? officeQrToken,
    ImageFilePayload? environmentPhoto,
  });
}
