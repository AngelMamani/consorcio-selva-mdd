import '../entities/app_user.dart';
import '../errors/domain_exception.dart';
import '../repositories/auth_repository.dart';
import '../repositories/user_repository.dart';

class LoginUseCase {
  LoginUseCase(this._authRepository, this._userRepository);

  final AuthRepository _authRepository;
  final UserRepository _userRepository;

  Future<AppUser> execute({
    required String identifier,
    required String password,
  }) async {
    final raw = identifier.trim();
    if (raw.isEmpty || password.isEmpty) {
      throw DomainException('Código y contraseña son obligatorios');
    }

    final email = raw.contains('@')
        ? raw.toLowerCase()
        : await _resolveDniEmail(raw);

    final userId = await _authRepository.login(
      email: email,
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

  Future<String> _resolveDniEmail(String identifier) async {
    final dni = identifier.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^\d{8}$').hasMatch(dni)) {
      throw DomainException(
        'Ingresa tu código (DNI de 8 dígitos)',
      );
    }
    return _authRepository.resolveEmailByDni(dni);
  }
}
