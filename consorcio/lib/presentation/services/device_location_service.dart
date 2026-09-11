import 'package:geolocator/geolocator.dart';

import '../../domain/errors/domain_exception.dart';
import '../../domain/value_objects/geo_location.dart';

class DeviceLocationService {
  Future<bool> isGpsActive() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return false;
    final permission = await Geolocator.checkPermission();
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Stream<ServiceStatus> watchGpsService() {
    return Geolocator.getServiceStatusStream();
  }

  Future<void> openGpsSettings() {
    return Geolocator.openLocationSettings();
  }

  Future<void> openAppSettings() {
    return Geolocator.openAppSettings();
  }

  Future<LocationPermission> ensurePermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission;
  }

  Future<void> _ensureGpsReady({
    required bool openSettingsIfDisabled,
    required String purpose,
  }) async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (openSettingsIfDisabled) {
        await Geolocator.openLocationSettings();
      }
      throw DomainException(
        'El GPS está apagado. Actívalo para $purpose.',
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      throw DomainException(
        'Necesitamos permiso de ubicación para $purpose.',
      );
    }

    if (permission == LocationPermission.deniedForever) {
      await Geolocator.openAppSettings();
      throw DomainException(
        'Permiso de ubicación bloqueado. Actívalo en Ajustes del celular.',
      );
    }
  }

  GeoLocation _fromPosition(Position position) {
    return GeoLocation(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracy,
      capturedAt: position.timestamp,
    );
  }

  /// Prefer last-known / medium accuracy so screens open quickly.
  Future<GeoLocation?> tryQuickLocation({
    Duration maxAge = const Duration(minutes: 2),
  }) async {
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        final age = DateTime.now().difference(last.timestamp);
        if (!age.isNegative && age <= maxAge) {
          return _fromPosition(last);
        }
      }
    } catch (_) {}

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 6),
        ),
      );
      return _fromPosition(position);
    } catch (_) {
      return null;
    }
  }

  Future<GeoLocation> getCurrentLocation({
    bool openSettingsIfDisabled = true,
    String purpose = 'asignar la ubicación',
    bool preferQuick = true,
  }) async {
    await _ensureGpsReady(
      openSettingsIfDisabled: openSettingsIfDisabled,
      purpose: purpose,
    );

    if (preferQuick) {
      final quick = await tryQuickLocation();
      if (quick != null) return quick;
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 12),
        ),
      );
      return _fromPosition(position);
    } on DomainException {
      rethrow;
    } catch (_) {
      throw DomainException(
        'No se pudo obtener el GPS. Sal al exterior o reintenta en unos segundos.',
      );
    }
  }
}
