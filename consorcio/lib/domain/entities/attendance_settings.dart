import '../services/geo_distance_service.dart';
import '../value_objects/geo_location.dart';

class AttendanceOfficePoint {
  const AttendanceOfficePoint({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
  });

  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final int radiusMeters;
}

class OfficeMatchResult {
  const OfficeMatchResult({
    required this.point,
    required this.distanceMeters,
  });

  final AttendanceOfficePoint point;
  final int distanceMeters;
}

class AttendanceSettings {
  const AttendanceSettings({
    required this.officePoints,
    required this.officeName,
    required this.officeLatitude,
    required this.officeLongitude,
    required this.officeRadiusMeters,
  });

  final List<AttendanceOfficePoint> officePoints;
  final String officeName;
  final double officeLatitude;
  final double officeLongitude;
  final int officeRadiusMeters;

  static const defaults = AttendanceSettings(
    officePoints: [
      AttendanceOfficePoint(
        id: 'default',
        name: 'Oficina Consorcio Selva MDD',
        latitude: -12.59331,
        longitude: -69.18915,
        radiusMeters: 30,
      ),
    ],
    officeName: 'Oficina Consorcio Selva MDD',
    officeLatitude: -12.59331,
    officeLongitude: -69.18915,
    officeRadiusMeters: 30,
  );

  static int normalizeRadius(int meters) {
    if (meters < 10 || meters > 80) return 30;
    return meters;
  }

  List<AttendanceOfficePoint> get resolvedOfficePoints {
    if (officePoints.isNotEmpty) return officePoints;
    return [
      AttendanceOfficePoint(
        id: 'legacy',
        name: officeName,
        latitude: officeLatitude,
        longitude: officeLongitude,
        radiusMeters: normalizeRadius(officeRadiusMeters),
      ),
    ];
  }

  OfficeMatchResult? findMatchingOfficePoint(GeoLocation location) {
    OfficeMatchResult? best;
    for (final point in resolvedOfficePoints) {
      final distance = distanceMeters(
        latitudeA: location.latitude,
        longitudeA: location.longitude,
        latitudeB: point.latitude,
        longitudeB: point.longitude,
      ).round();
      if (distance > point.radiusMeters) continue;
      if (best == null || distance < best.distanceMeters) {
        best = OfficeMatchResult(point: point, distanceMeters: distance);
      }
    }
    return best;
  }
}
