import 'package:geolocator/geolocator.dart';

import '../../domain/errors/domain_exception.dart';
import '../../domain/value_objects/geo_location.dart';

class DeviceLocationService {
  Future<GeoLocation> getCurrentLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw DomainException(
        'El GPS está apagado. Actívalo para registrar la ubicación.',
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      throw DomainException(
        'Necesitamos permiso de ubicación para el mapeo de campo.',
      );
    }

    if (permission == LocationPermission.deniedForever) {
      throw DomainException(
        'Permiso de ubicación bloqueado. Actívalo en Ajustes del celular.',
      );
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );

      return GeoLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
        capturedAt: DateTime.now(),
      );
    } on DomainException {
      rethrow;
    } catch (_) {
      throw DomainException(
        'No se pudo obtener el GPS. Sal al exterior o reintenta en unos segundos.',
      );
    }
  }
}
