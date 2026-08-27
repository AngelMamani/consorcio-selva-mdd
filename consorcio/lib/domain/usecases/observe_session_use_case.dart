import '../entities/app_user.dart';
import '../repositories/auth_repository.dart';
import '../repositories/user_repository.dart';

class ObserveSessionUseCase {
  ObserveSessionUseCase(this._authRepository, this._userRepository);

  final AuthRepository _authRepository;
  final UserRepository _userRepository;

  Stream<AppUser?> execute() {
    return _authRepository.observeAuthState().asyncMap((userId) async {
      if (userId == null) return null;

      final user = await _userRepository.getById(userId);
      if (user == null || !user.active || user.mobileRoles.isEmpty) {
        await _authRepository.logout();
        return null;
      }

      return user;
    });
  }
}
