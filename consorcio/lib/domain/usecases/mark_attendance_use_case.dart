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
      final note = permissionNote.trim();
      return _attendanceRepository.create(
        userId: actor.id,
        userName: actor.displayName,
        dateKey: dateKey,
        origin: origin,
        areaId: '',
        areaName: '',
        location: const GeoLocation(latitude: 0, longitude: 0),
        officeValidated: false,
        permissionNote: note.length > 200 ? note.substring(0, 200) : note,
      );
    }

    if (location == null || !location.isValid) {
      throw DomainException('Activa el GPS para marcar asistencia');
    }

    var officeValidated = false;
    int? distanceToOffice;

    if (origin == AttendanceOrigin.oficina) {
      final settings = await _attendanceRepository.getSettings();
      distanceToOffice = distanceMeters(
        latitudeA: location.latitude,
        longitudeA: location.longitude,
        latitudeB: settings.officeLatitude,
        longitudeB: settings.officeLongitude,
      ).round();
      if (distanceToOffice > settings.officeRadiusMeters) {
        throw DomainException(
          'Estás a $distanceToOffice m de ${settings.officeName}. '
          'Acércate a menos de ${settings.officeRadiusMeters} m para marcar en oficina.',
        );
      }
      officeValidated = true;
    }

    return _attendanceRepository.create(
      userId: actor.id,
      userName: actor.displayName,
      dateKey: dateKey,
      origin: origin,
      areaId: '',
      areaName: '',
      location: location,
      officeValidated: officeValidated,
      distanceToOfficeMeters: distanceToOffice,
      environmentPhoto: origin == AttendanceOrigin.zona ? environmentPhoto : null,
    );
  }
}
