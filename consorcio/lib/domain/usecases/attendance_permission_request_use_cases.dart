import '../entities/app_user.dart';
import '../entities/attendance_permission_request.dart';
import '../errors/domain_exception.dart';
import '../repositories/attendance_permission_request_repository.dart';
import '../repositories/folder_image_repository.dart';

const minPermissionDescription = 8;
const maxPermissionDescription = 500;

class RequestAttendancePermissionUseCase {
  RequestAttendancePermissionUseCase(this._repository);

  final AttendancePermissionRequestRepository _repository;

  Future<AttendancePermissionRequest> execute(
    AppUser actor, {
    required String description,
    ImageFilePayload? evidencePhoto,
  }) async {
    actor.assertCanOperateApp();
    final text = description.trim();
    if (text.length < minPermissionDescription) {
      throw DomainException(
        'Describe el motivo del permiso (mínimo $minPermissionDescription caracteres)',
      );
    }
    if (text.length > maxPermissionDescription) {
      throw DomainException('La descripción es demasiado larga');
    }
    if (evidencePhoto != null &&
        (evidencePhoto.sizeBytes <= 0 ||
            evidencePhoto.sizeBytes > 10 * 1024 * 1024)) {
      throw DomainException('La foto debe pesar máximo 10 MB');
    }

    final pending = await _repository.listPendingByUser(actor.id);
    if (pending.isNotEmpty) {
      throw DomainException(
        'Ya tienes una solicitud de permiso pendiente. '
        'Espera la respuesta del administrador.',
      );
    }

    return _repository.create(
      userId: actor.id,
      userName: actor.displayName.trim().isEmpty
          ? 'Usuario'
          : (actor.displayName.trim().length > 120
              ? actor.displayName.trim().substring(0, 120)
              : actor.displayName.trim()),
      description: text.substring(
        0,
        text.length > maxPermissionDescription
            ? maxPermissionDescription
            : text.length,
      ),
      evidencePhoto: evidencePhoto,
    );
  }
}

class ListMyAttendancePermissionRequestsUseCase {
  ListMyAttendancePermissionRequestsUseCase(this._repository);

  final AttendancePermissionRequestRepository _repository;

  Future<List<AttendancePermissionRequest>> execute(AppUser actor) async {
    actor.assertCanOperateApp();
    return _repository.listByUser(actor.id);
  }
}
