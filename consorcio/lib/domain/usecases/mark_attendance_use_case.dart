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
    required GeoLocation location,
    String? officeQrPayload,
    ImageFilePayload? environmentPhoto,
  }) async {
    actor.assertCanOperateApp();
    if (!location.isValid) {
      throw DomainException('Activa el GPS para marcar asistencia');
    }
    if (environmentPhoto != null &&
        (environmentPhoto.sizeBytes <= 0 ||
            environmentPhoto.sizeBytes > 10 * 1024 * 1024)) {
      throw DomainException('La foto debe pesar máximo 10 MB');
    }

    final dateKey = limaDateKey();
    final existing =
        await _attendanceRepository.getByUserAndDate(actor.id, dateKey);
    if (existing != null) {
      throw DomainException('Ya marcaste asistencia hoy');
    }

    var officeValidated = false;
    int? distanceToOffice;
    String? officeQrToken;

    if (origin == AttendanceOrigin.oficina) {
      final qr = parseOfficeQrPayload(officeQrPayload ?? '');
      if (qr == null) {
        throw DomainException(
          'Escanea el QR de oficina de hoy. El código cambia cada día.',
        );
      }
      if (qr.dateKey != dateKey) {
        throw DomainException(
          'Ese QR no es de hoy. Pide el código actualizado en oficina.',
        );
      }
      officeQrToken = qr.token;

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
      officeQrToken: officeQrToken,
      environmentPhoto: origin == AttendanceOrigin.zona ? environmentPhoto : null,
    );
  }
}
