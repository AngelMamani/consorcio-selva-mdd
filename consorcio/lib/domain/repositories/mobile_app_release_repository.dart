import '../entities/mobile_app_release.dart';

abstract class MobileAppReleaseRepository {
  Future<MobileAppRelease?> getRelease();
}
