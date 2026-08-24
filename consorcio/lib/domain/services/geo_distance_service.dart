import 'dart:math' as math;

double distanceMeters({
  required double latitudeA,
  required double longitudeA,
  required double latitudeB,
  required double longitudeB,
}) {
  const earthRadius = 6371000.0;
  double toRad(double value) => value * math.pi / 180;
  final dLat = toRad(latitudeB - latitudeA);
  final dLng = toRad(longitudeB - longitudeA);
  final lat1 = toRad(latitudeA);
  final lat2 = toRad(latitudeB);
  final haversine = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(lat1) * math.cos(lat2) * math.sin(dLng / 2) * math.sin(dLng / 2);
  return 2 * earthRadius * math.asin(math.min(1, math.sqrt(haversine)));
}

class GeoBoundingBox {
  const GeoBoundingBox({
    required this.minLat,
    required this.maxLat,
    required this.minLng,
    required this.maxLng,
  });

  final double minLat;
  final double maxLat;
  final double minLng;
  final double maxLng;
}

GeoBoundingBox boundingBox({
  required double latitude,
  required double longitude,
  required double radiusMeters,
}) {
  const metersPerDegreeLat = 111320.0;
  final latDelta = radiusMeters / metersPerDegreeLat;
  final lngDelta = radiusMeters /
      (metersPerDegreeLat *
          math.max(0.2, math.cos(latitude * math.pi / 180)));
  return GeoBoundingBox(
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  );
}
