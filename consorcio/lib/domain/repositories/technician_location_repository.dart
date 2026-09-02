abstract class TechnicianLocationRepository {
  Future<void> publishLive({
    required String userId,
    required String displayName,
    required double latitude,
    required double longitude,
    required double? accuracyMeters,
    bool recordTrail = false,
  });

  Future<void> markGpsOff({
    required String userId,
    required String displayName,
  });
}
