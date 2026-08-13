import '../entities/app_user.dart';
import '../errors/domain_exception.dart';
import '../repositories/auth_repository.dart';
import '../repositories/user_repository.dart';

class LoginUseCase {
  LoginUseCase(this._authRepository, this._userRepository);

  final AuthRepository _authRepository;
  final UserRepository _userRepository;

  Future<AppUser> execute({
    required String email,
    required String password,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.isEmpty || password.isEmpty) {
      throw DomainException('Correo y contraseña son obligatorios');
    }

    final userId = await _authRepository.login(
      email: cleanEmail,
      password: password,
    );
    final user = await _userRepository.getById(userId);

    if (user == null) {
      await _authRepository.logout();
      throw DomainException('Usuario sin perfil registrado');
    }

    if (!user.active) {
      await _authRepository.logout();
      throw DomainException('Tu cuenta está desactivada');
    }

    if (!user.isTechnician) {
      await _authRepository.logout();
      throw DomainException(
        'Esta app es solo para técnicos. Usa el panel web si eres administrador.',
      );
    }

    return user;
  }
}
