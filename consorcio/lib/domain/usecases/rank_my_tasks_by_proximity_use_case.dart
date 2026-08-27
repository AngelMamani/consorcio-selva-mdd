import '../entities/field_task.dart';
import '../repositories/supply_repository.dart';
import '../services/geo_distance_service.dart';
import '../value_objects/geo_location.dart';

class RankedFieldTask {
  const RankedFieldTask({
    required this.task,
    required this.routeCode,
    required this.routeNote,
    required this.routeCompleted,
    required this.distanceMeters,
    required this.hasSupplyLocation,
    required this.isRecommended,
    this.latitude,
    this.longitude,
  });

  final FieldTask task;
  final String routeCode;
  final String routeNote;
  final bool routeCompleted;
  final double? distanceMeters;
  final bool hasSupplyLocation;
  final bool isRecommended;
  final double? latitude;
  final double? longitude;

  String get key => '${task.id}:$routeCode';

  bool get hasMapPoint =>
      hasSupplyLocation && latitude != null && longitude != null;

  TaskRoute? get matchedRoute {
    for (final route in task.normalizedRoutes) {
      if (route.routeCode == routeCode) return route;
    }
    return null;
  }

  bool get photosUploaded => matchedRoute?.photosUploaded ?? false;

  String get claimedById => matchedRoute?.claimedById ?? '';

  String get claimedByName => matchedRoute?.claimedByName ?? '';

  bool get isClaimed => claimedById.isNotEmpty;

  bool isClaimedBy(String userId) => matchedRoute?.isClaimedBy(userId) ?? false;

  RankedFieldTask copyWith({
    FieldTask? task,
    bool? routeCompleted,
    bool? isRecommended,
    double? latitude,
    double? longitude,
    bool? hasSupplyLocation,
    double? distanceMeters,
  }) {
    return RankedFieldTask(
      task: task ?? this.task,
      routeCode: routeCode,
      routeNote: routeNote,
      routeCompleted: routeCompleted ?? this.routeCompleted,
      distanceMeters: distanceMeters ?? this.distanceMeters,
      hasSupplyLocation: hasSupplyLocation ?? this.hasSupplyLocation,
      isRecommended: isRecommended ?? this.isRecommended,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
    );
  }
}

class RankMyTasksByProximityUseCase {
  RankMyTasksByProximityUseCase(this._supplyRepository);

  final SupplyRepository _supplyRepository;

  Future<List<RankedFieldTask>> execute({
    required List<FieldTask> tasks,
    required GeoLocation location,
  }) async {
    final missingCodes = <String>{};
    for (final task in tasks) {
      for (final route in task.normalizedRoutes) {
        if (!route.hasMapPoint && route.routeCode.isNotEmpty) {
          missingCodes.add(route.routeCode);
        }
      }
    }

    final catalogCoords = <String, ({double lat, double lng})>{};
    await Future.wait(
      missingCodes.map((code) async {
        final supply = await _supplyRepository.getByRouteCode(code);
        if (supply == null || !supply.hasLocation) return;
        catalogCoords[code] = (lat: supply.latitude!, lng: supply.longitude!);
      }),
    );

    final ranked = <RankedFieldTask>[];
    for (final task in tasks) {
      for (final route in task.normalizedRoutes) {
        final point = route.hasMapPoint
            ? (lat: route.latitude!, lng: route.longitude!)
            : catalogCoords[route.routeCode];
        final distance = point == null
            ? null
            : distanceMeters(
                latitudeA: location.latitude,
                longitudeA: location.longitude,
                latitudeB: point.lat,
                longitudeB: point.lng,
              );
        ranked.add(
          RankedFieldTask(
            task: task,
            routeCode: route.routeCode,
            routeNote: route.note,
            routeCompleted: route.completed || task.isCompleted,
            distanceMeters: distance,
            hasSupplyLocation: point != null,
            isRecommended: false,
            latitude: point?.lat,
            longitude: point?.lng,
          ),
        );
      }
    }

    final open = ranked.where((item) => !item.routeCompleted).toList();
    final done = ranked.where((item) => item.routeCompleted).toList();

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

    return [
      ...open.asMap().entries.map((entry) {
        final item = entry.value;
        return RankedFieldTask(
          task: item.task,
          routeCode: item.routeCode,
          routeNote: item.routeNote,
          routeCompleted: item.routeCompleted,
          distanceMeters: item.distanceMeters,
          hasSupplyLocation: item.hasSupplyLocation,
          isRecommended: entry.key == 0 && item.hasSupplyLocation,
          latitude: item.latitude,
          longitude: item.longitude,
        );
      }),
      ...done,
    ];
  }
}

String formatTaskDistance(double? meters) {
  if (meters == null) return 'Sin GPS de suministro';
  if (meters < 1000) return '${meters.round()} m';
  return '${(meters / 1000).toStringAsFixed(1)} km';
}

List<RankedFieldTask> applyUpdatedTaskToRanked(
  List<RankedFieldTask> ranked,
  FieldTask updated,
) {
  return [
    for (final item in ranked)
      if (item.task.id != updated.id)
        item
      else
        item.copyWith(
          task: updated,
          routeCompleted: updated.isCompleted ||
              updated.normalizedRoutes.any(
                (route) =>
                    route.routeCode == item.routeCode && route.completed,
              ),
        ),
  ];
}
