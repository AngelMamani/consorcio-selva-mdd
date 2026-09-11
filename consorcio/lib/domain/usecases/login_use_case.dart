import '../entities/app_user.dart';
import '../errors/domain_exception.dart';
import '../repositories/auth_repository.dart';
import '../repositories/user_repository.dart';
import '../value_objects/user_role.dart';

class LoginUseCase {
  LoginUseCase(this._authRepository, this._userRepository);

  final AuthRepository _authRepository;
  final UserRepository _userRepository;

  static bool _isCredentialError(String message) {
    return message.contains('incorrectos') ||
        message.contains('incorrecto');
  }

  Future<AppUser> execute({
    required String identifier,
    required String password,
  }) async {
    final raw = identifier.trim();
    if (raw.isEmpty || password.isEmpty) {
      throw DomainException('Código y contraseña son obligatorios');
    }

    final dni = raw.contains('@')
        ? null
        : raw.replaceAll(RegExp(r'\D'), '');
    if (dni != null && !RegExp(r'^\d{8}$').hasMatch(dni)) {
      throw DomainException('Ingresa tu código (DNI de 8 dígitos)');
    }

    final email = raw.contains('@')
        ? raw.toLowerCase()
        : await _authRepository.resolveEmailByDni(dni!);

    String userId;
    try {
      userId = await _authRepository.login(email: email, password: password);
    } on DomainException catch (error) {
      // Caché DNI desactualizada tras remapear email en consola.
      if (dni != null && _isCredentialError(error.message)) {
        await _authRepository.clearDniEmailCache(dni);
        final freshEmail = await _authRepository.resolveEmailByDni(
          dni,
          forceRefresh: true,
        );
        if (freshEmail != email) {
          userId = await _authRepository.login(
            email: freshEmail,
            password: password,
          );
        } else {
          rethrow;
        }
      } else {
        rethrow;
      }
    }

    late final AppUser? user;
    try {
      user = await _userRepository.getById(userId);
    } on DomainException catch (error) {
      await _authRepository.logout();
      throw DomainException(error.message);
    } catch (_) {
      await _authRepository.logout();
      throw DomainException(
        'Red lenta al leer tu perfil. Intenta de nuevo.',
      );
    }

    if (user == null) {
      await _authRepository.logout();
      throw DomainException('Usuario sin perfil registrado');
    }

    if (!user.active) {
      await _authRepository.logout();
      throw DomainException('Tu cuenta está desactivada');
    }

    final mobile = user.mobileRoles;
    if (mobile.isEmpty) {
      await _authRepository.logout();
      if (user.assignedRoles.contains(UserRole.superAdministrador)) {
        throw DomainException(
          'El Super Administrador ingresa desde el panel web.',
        );
      }
      throw DomainException(
        'Esta app es para Administrador y Técnico. Usa el panel web.',
      );
    }

    return user;
  }
}
