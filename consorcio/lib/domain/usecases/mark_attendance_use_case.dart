import '../entities/app_user.dart';
import '../entities/attendance.dart';
import '../errors/domain_exception.dart';
import '../repositories/area_repository.dart';
import '../repositories/attendance_repository.dart';
import '../repositories/folder_image_repository.dart';
import '../services/geo_distance_service.dart';
import '../value_objects/geo_location.dart';

class MarkAttendanceUseCase {
  MarkAttendanceUseCase(this._attendanceRepository, this._areaRepository);

  final AttendanceRepository _attendanceRepository;
  final AreaRepository _areaRepository;

  Future<Attendance> execute(
    AppUser actor, {
    required AttendanceOrigin origin,
    required GeoLocation location,
    String? areaId,
    String? officeQrPayload,
    required ImageFilePayload environmentPhoto,
  }) async {
    actor.assertCanOperateApp();
    if (!location.isValid) {
      throw DomainException('Activa el GPS para marcar asistencia');
    }
    if (environmentPhoto.sizeBytes <= 0 ||
        environmentPhoto.sizeBytes > 10 * 1024 * 1024) {
      throw DomainException('La foto del entorno es obligatoria y debe pesar máximo 10 MB');
    }

    final dateKey = limaDateKey();
    final existing =
        await _attendanceRepository.getByUserAndDate(actor.id, dateKey);
    if (existing != null) {
      throw DomainException('Ya marcaste asistencia hoy');
    }

    var selectedAreaId = '';
    var selectedAreaName = '';
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
    } else {
      final id = areaId?.trim() ?? '';
      if (id.isEmpty) {
        throw DomainException('Elige el área o zona de trabajo');
      }
      final area = await _areaRepository.getById(id);
      if (area == null) {
        throw DomainException('Área no encontrada');
      }
      selectedAreaId = area.id;
      selectedAreaName = area.name;
    }

    return _attendanceRepository.create(
      userId: actor.id,
      userName: actor.displayName,
      dateKey: dateKey,
      origin: origin,
      areaId: selectedAreaId,
      areaName: selectedAreaName,
      location: location,
      officeValidated: officeValidated,
      distanceToOfficeMeters: distanceToOffice,
      officeQrToken: officeQrToken,
      environmentPhoto: environmentPhoto,
    );
  }
}
