class GeoLocation {
  const GeoLocation({
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.capturedAt,
  });

  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final DateTime? capturedAt;

  bool get isValid =>
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;

  Map<String, dynamic> toFirestoreFields() {
    return {
      'latitude': latitude,
      'longitude': longitude,
      if (accuracyMeters != null) 'locationAccuracy': accuracyMeters,
      'locationCapturedAt': capturedAt ?? DateTime.now(),
    };
  }

  static GeoLocation? tryParse(Map<String, dynamic> data) {
    final lat = data['latitude'];
    final lng = data['longitude'];
    if (lat is! num || lng is! num) return null;
    final location = GeoLocation(
      latitude: lat.toDouble(),
      longitude: lng.toDouble(),
      accuracyMeters: (data['locationAccuracy'] as num?)?.toDouble(),
      capturedAt: data['locationCapturedAt'] is DateTime
          ? data['locationCapturedAt'] as DateTime
          : null,
    );
    return location.isValid ? location : null;
  }
}
