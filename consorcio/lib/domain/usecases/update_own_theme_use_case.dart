import '../entities/app_user.dart';
import '../errors/domain_exception.dart';
import '../repositories/user_repository.dart';
import '../value_objects/theme_preference.dart';

class UpdateOwnThemeUseCase {
  UpdateOwnThemeUseCase(this._userRepository);

  final UserRepository _userRepository;

  Future<AppUser> execute(AppUser actor, String theme) async {
    if (!actor.active) {
      throw DomainException('Cuenta inactiva');
    }

    final nextTheme = ThemePreference.normalize(theme);
    if (nextTheme != ThemePreference.light &&
        nextTheme != ThemePreference.dark) {
      throw DomainException('Tema inválido');
    }

    return _userRepository.updateTheme(
      userId: actor.id,
      theme: nextTheme,
    );
  }
}
