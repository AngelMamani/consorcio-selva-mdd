class Supply {
  const Supply({
    required this.id,
    required this.routeCode,
    this.latitude,
    this.longitude,
    required this.prefix,
    this.note = '',
  });

  final String id;
  final String routeCode;
  final double? latitude;
  final double? longitude;
  final String prefix;
  final String note;

  bool get hasLocation {
    final lat = latitude;
    final lng = longitude;
    return lat != null &&
        lng != null &&
        lat.isFinite &&
        lng.isFinite &&
        !(lat == 0 && lng == 0);
  }

  String get coordinatesLabel => hasLocation
      ? '${latitude!.toStringAsFixed(6)}, ${longitude!.toStringAsFixed(6)}'
      : 'Sin ubicación GPS';
}

class SupplyCatalogStatus {
  const SupplyCatalogStatus({
    required this.supplyCount,
    required this.sedCount,
  });

  final int supplyCount;
  final int sedCount;
}

class Sed {
  const Sed({
    required this.id,
    required this.code,
    required this.name,
    required this.latitude,
    required this.longitude,
  });

  final String id;
  final String code;
  final String name;
  final double latitude;
  final double longitude;

  String get coordinatesLabel =>
      '${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}';
}

class StationHit {
  const StationHit({
    required this.kind,
    required this.code,
    required this.detail,
    required this.latitude,
    required this.longitude,
  });

  final String kind;
  final String code;
  final String detail;
  final double latitude;
  final double longitude;

  bool get isSed => kind == 'sed';

  String get coordinatesLabel =>
      '${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}';
}

class NearbySupply {
  const NearbySupply({
    required this.routeCode,
    required this.latitude,
    required this.longitude,
    required this.distanceMeters,
  });

  final String routeCode;
  final double latitude;
  final double longitude;
  final double distanceMeters;

  String get distanceLabel {
    if (distanceMeters < 1000) {
      return '${distanceMeters.round()} m';
    }
    return '${(distanceMeters / 1000).toStringAsFixed(1)} km';
  }
}

const sedFeederRadiusMeters = 300.0;
