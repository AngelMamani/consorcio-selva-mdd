import '../entities/app_user.dart';
import '../entities/mobile_app_release.dart';
import '../repositories/mobile_app_release_repository.dart';

class GetMobileAppReleaseUseCase {
  GetMobileAppReleaseUseCase(this._repository);

  final MobileAppReleaseRepository _repository;

  Future<MobileAppRelease?> execute(AppUser actor) async {
    actor.assertCanOperateApp();
    return _repository.getRelease();
  }
}
