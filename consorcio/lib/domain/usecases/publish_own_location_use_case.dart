import '../entities/app_user.dart';
import '../repositories/technician_location_repository.dart';

class PublishOwnLocationUseCase {
  PublishOwnLocationUseCase(this._repository);

  final TechnicianLocationRepository _repository;

  Future<void> publishLive({
    required AppUser actor,
    required double latitude,
    required double longitude,
    required double? accuracyMeters,
    bool recordTrail = false,
  }) {
    actor.assertCanOperateApp();
    return _repository.publishLive(
      userId: actor.id,
      displayName: actor.displayName,
      latitude: latitude,
      longitude: longitude,
      accuracyMeters: accuracyMeters,
      recordTrail: recordTrail,
    );
  }

  Future<void> markGpsOff(AppUser actor) {
    actor.assertCanOperateApp();
    return _repository.markGpsOff(
      userId: actor.id,
      displayName: actor.displayName,
    );
  }
}
