import 'dart:async';
import 'dart:io' show Platform;

import 'package:geolocator/geolocator.dart';

import '../../domain/entities/app_user.dart';
import '../../domain/usecases/publish_own_location_use_case.dart';
import '../../domain/value_objects/geo_location.dart';

class LocationShareController {
  LocationShareController(this._useCase);

  final PublishOwnLocationUseCase _useCase;

  StreamSubscription<Position>? _positionSub;
  Timer? _heartbeat;
  AppUser? _user;
  bool _gpsReady = false;
  bool _markedOff = false;
  Position? _lastPosition;
  Position? _lastTrailPosition;

  static const _minTrailMeters = 60.0;
  static const _freshAge = Duration(seconds: 90);

  bool get isGpsReady => _gpsReady;

  void attach(AppUser user) {
    _user = user;
  }

  /// Cached live position for attendance / ranking (null if stale).
  GeoLocation? get lastGeoLocation {
    final position = _lastPosition;
    if (position == null) return null;
    final age = DateTime.now().difference(position.timestamp);
    if (age.isNegative || age > _freshAge) return null;
    return GeoLocation(
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracy,
      capturedAt: position.timestamp,
    );
  }

  Future<void> setGpsReady(bool ready) async {
    if (_gpsReady == ready && _positionSub != null && ready) return;
    _gpsReady = ready;
    if (ready) {
      _markedOff = false;
      await _startLive();
      return;
    }
    await _stopLive();
    await _markOff();
  }

  Future<void> _startLive() async {
    await _stopLive();
    _lastTrailPosition = null;
    await _publishCurrent();
    _positionSub = Geolocator.getPositionStream(
      locationSettings: Platform.isAndroid
          ? AndroidSettings(
              accuracy: LocationAccuracy.medium,
              distanceFilter: 40,
              intervalDuration: const Duration(seconds: 60),
            )
          : const LocationSettings(
              accuracy: LocationAccuracy.medium,
              distanceFilter: 40,
            ),
    ).listen(
      (position) {
        _lastPosition = position;
        unawaited(_publish(position));
      },
      onError: (_) {},
    );
    _heartbeat = Timer.periodic(const Duration(seconds: 90), (_) {
      unawaited(_publishCurrent());
    });
  }

  Future<void> _publishCurrent() async {
    try {
      final position = _lastPosition ??
          await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.medium,
              timeLimit: Duration(seconds: 8),
            ),
          );
      _lastPosition = position;
      await _publish(position);
    } catch (_) {}
  }

  bool _shouldRecordTrail(Position position) {
    final last = _lastTrailPosition;
    if (last == null) return true;
    return Geolocator.distanceBetween(
          last.latitude,
          last.longitude,
          position.latitude,
          position.longitude,
        ) >=
        _minTrailMeters;
  }

  Future<void> _publish(Position position) async {
    final user = _user;
    if (user == null || !_gpsReady) return;
    final recordTrail = _shouldRecordTrail(position);
    try {
      await _useCase.publishLive(
        actor: user,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
        recordTrail: recordTrail,
      );
      if (recordTrail) {
        _lastTrailPosition = position;
      }
    } catch (_) {}
  }

  Future<void> _markOff() async {
    final user = _user;
    if (user == null || _markedOff) return;
    _markedOff = true;
    try {
      await _useCase.markGpsOff(user);
    } catch (_) {}
  }

  Future<void> _stopLive() async {
    await _positionSub?.cancel();
    _positionSub = null;
    _heartbeat?.cancel();
    _heartbeat = null;
  }

  Future<void> dispose() async {
    await _stopLive();
    if (_gpsReady) {
      await _markOff();
    }
  }
}
