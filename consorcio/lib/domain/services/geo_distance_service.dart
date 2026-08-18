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
