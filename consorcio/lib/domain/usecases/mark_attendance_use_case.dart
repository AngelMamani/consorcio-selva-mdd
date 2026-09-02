import '../entities/app_user.dart';
import '../entities/attendance.dart';
import '../errors/domain_exception.dart';
import '../repositories/attendance_repository.dart';
import '../repositories/folder_image_repository.dart';
import '../services/geo_distance_service.dart';
import '../value_objects/geo_location.dart';

class MarkAttendanceUseCase {
  MarkAttendanceUseCase(this._attendanceRepository);

  final AttendanceRepository _attendanceRepository;

  Future<Attendance> execute(
    AppUser actor, {
    required AttendanceOrigin origin,
    GeoLocation? location,
    String permissionNote = '',
    ImageFilePayload? environmentPhoto,
  }) async {
    actor.assertCanOperateApp();
    if (environmentPhoto != null &&
        (environmentPhoto.sizeBytes <= 0 ||
            environmentPhoto.sizeBytes > 10 * 1024 * 1024)) {
      throw DomainException('La foto debe pesar máximo 10 MB');
    }

    final dateKey = limaDateKey();
    final existing =
        await _attendanceRepository.getByUserAndDate(actor.id, dateKey);
    if (existing != null) {
      throw DomainException('Ya tienes asistencia o permiso registrado hoy');
    }

    if (origin == AttendanceOrigin.permiso) {
      throw DomainException(
        'Solo un administrador puede registrar permisos. Contacta a tu supervisor.',
      );
    }

    if (location == null || !location.isValid) {
      throw DomainException('Activa el GPS para marcar asistencia');
    }

    var officeValidated = false;
    int? distanceToOffice;
    var areaId = '';
    var areaName = '';

    if (origin == AttendanceOrigin.oficina) {
      final settings = await _attendanceRepository.getSettings();
      final match = settings.findMatchingOfficePoint(location);
      if (match == null) {
        final points = settings.resolvedOfficePoints;
        final nearest = points
            .map(
              (point) => (
                point: point,
                distance: distanceMeters(
                  latitudeA: location.latitude,
                  longitudeA: location.longitude,
                  latitudeB: point.latitude,
                  longitudeB: point.longitude,
                ).round(),
              ),
            )
            .toList()
          ..sort((a, b) => a.distance.compareTo(b.distance));
        final hint = nearest.isEmpty
            ? 'No hay puntos de oficina configurados.'
            : 'El más cercano es «${nearest.first.point.name}» '
                '(${nearest.first.distance} m).';
        throw DomainException(
          'No estás dentro del radio de un punto de oficina autorizado. $hint',
        );
      }
      officeValidated = true;
      distanceToOffice = match.distanceMeters;
      areaId = match.point.id;
      areaName = match.point.name;
    }

    return _attendanceRepository.create(
      userId: actor.id,
      userName: actor.displayName,
      dateKey: dateKey,
      origin: origin,
      areaId: areaId,
      areaName: areaName,
      location: location,
      officeValidated: officeValidated,
      distanceToOfficeMeters: distanceToOffice,
      environmentPhoto: origin == AttendanceOrigin.zona ? environmentPhoto : null,
    );
  }
}
