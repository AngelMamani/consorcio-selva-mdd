import '../entities/app_user.dart';
import '../errors/domain_exception.dart';
import '../repositories/auth_repository.dart';
import '../repositories/user_repository.dart';
import '../value_objects/password_policy.dart';

class ChangeOwnPasswordUseCase {
  ChangeOwnPasswordUseCase(this._authRepository, this._userRepository);

  final AuthRepository _authRepository;
  final UserRepository _userRepository;

  Future<AppUser> execute({
    required AppUser actor,
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (!actor.active) {
      throw DomainException('Cuenta inactiva');
    }

    if (!actor.mustChangePassword) {
      throw DomainException('Tu contraseña ya fue actualizada');
    }

    if (newPassword.isEmpty || confirmPassword.isEmpty) {
      throw DomainException('Completa ambos campos de contraseña');
    }

    if (newPassword != confirmPassword) {
      throw DomainException('Las contraseñas no coinciden');
    }

    if (!isSecurePassword(newPassword)) {
      throw DomainException(securePasswordRequirementsMessage());
    }

    if (newPassword == defaultTemporaryPassword) {
      throw DomainException(
        'Debes elegir una contraseña distinta a la temporal',
      );
    }

    await _authRepository.updatePassword(newPassword);

    return _userRepository.updateMustChangePassword(
      userId: actor.id,
      mustChangePassword: false,
    );
  }
}
