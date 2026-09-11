import '../entities/attendance_permission_request.dart';
import 'folder_image_repository.dart';

abstract class AttendancePermissionRequestRepository {
  Future<AttendancePermissionRequest> create({
    required String userId,
    required String userName,
    required String description,
    ImageFilePayload? evidencePhoto,
  });

  Future<List<AttendancePermissionRequest>> listByUser(String userId);

  Future<List<AttendancePermissionRequest>> listPendingByUser(String userId);
}
