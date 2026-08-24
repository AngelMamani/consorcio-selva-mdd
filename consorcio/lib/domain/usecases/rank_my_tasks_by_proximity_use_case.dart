import '../entities/field_task.dart';
import '../repositories/supply_repository.dart';
import '../services/geo_distance_service.dart';
import '../value_objects/geo_location.dart';

class RankedFieldTask {
  const RankedFieldTask({
    required this.task,
    required this.distanceMeters,
    required this.hasSupplyLocation,
    required this.isRecommended,
    this.latitude,
    this.longitude,
  });

  final FieldTask task;
  final double? distanceMeters;
  final bool hasSupplyLocation;
  final bool isRecommended;
  final double? latitude;
  final double? longitude;

  bool get hasMapPoint =>
      hasSupplyLocation && latitude != null && longitude != null;
}

class RankMyTasksByProximityUseCase {
  RankMyTasksByProximityUseCase(this._supplyRepository);

  final SupplyRepository _supplyRepository;

  Future<List<RankedFieldTask>> execute({
    required List<FieldTask> tasks,
    required GeoLocation location,
  }) async {
    final missingCodes = tasks
        .where((task) => !task.hasStoredMapPoint)
        .map((task) => task.routeCode.trim())
        .where((code) => code.isNotEmpty)
        .toSet()
        .toList();

    final catalogCoords = <String, ({double lat, double lng})>{};
    await Future.wait(
      missingCodes.map((code) async {
        final supply = await _supplyRepository.getByRouteCode(code);
        if (supply == null) return;
        catalogCoords[code] = (lat: supply.latitude, lng: supply.longitude);
      }),
    );

    final open = <RankedFieldTask>[];
    final done = <RankedFieldTask>[];

    for (final task in tasks) {
      final code = task.routeCode.trim();
      final point = task.hasStoredMapPoint
          ? (lat: task.latitude!, lng: task.longitude!)
          : catalogCoords[code];
      final distance = point == null
          ? null
          : distanceMeters(
              latitudeA: location.latitude,
              longitudeA: location.longitude,
              latitudeB: point.lat,
              longitudeB: point.lng,
            );
      final ranked = RankedFieldTask(
        task: task,
        distanceMeters: distance,
        hasSupplyLocation: point != null,
        isRecommended: false,
        latitude: point?.lat,
        longitude: point?.lng,
      );
      if (task.isCompleted) {
        done.add(ranked);
      } else {
        open.add(ranked);
      }
    }

    open.sort((left, right) {
      final leftDistance = left.distanceMeters;
      final rightDistance = right.distanceMeters;
      if (leftDistance == null && rightDistance == null) {
        return right.task.updatedAt.compareTo(left.task.updatedAt);
      }
      if (leftDistance == null) return 1;
      if (rightDistance == null) return -1;
      final byDistance = leftDistance.compareTo(rightDistance);
      if (byDistance != 0) return byDistance;
      if (left.task.isInProgress != right.task.isInProgress) {
        return left.task.isInProgress ? -1 : 1;
      }
      return right.task.updatedAt.compareTo(left.task.updatedAt);
    });

    done.sort((left, right) => right.task.updatedAt.compareTo(left.task.updatedAt));

    final ranked = <RankedFieldTask>[
      ...open.asMap().entries.map((entry) {
        final item = entry.value;
        return RankedFieldTask(
          task: item.task,
          distanceMeters: item.distanceMeters,
          hasSupplyLocation: item.hasSupplyLocation,
          isRecommended: entry.key == 0 && item.hasSupplyLocation,
          latitude: item.latitude,
          longitude: item.longitude,
        );
      }),
      ...done,
    ];
    return ranked;
  }
}

String formatTaskDistance(double? meters) {
  if (meters == null) return 'Sin GPS de suministro';
  if (meters < 1000) return '${meters.round()} m';
  return '${(meters / 1000).toStringAsFixed(1)} km';
}
