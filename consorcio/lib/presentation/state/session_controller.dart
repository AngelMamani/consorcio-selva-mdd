import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/app_user.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/value_objects/theme_preference.dart';

class SessionController extends ChangeNotifier {
  SessionController(this._dependencies) {
    _subscription = _dependencies.observeSessionUseCase.execute().listen((
      nextUser,
    ) {
      user = nextUser;
      bootstrapping = false;
      notifyListeners();
    });
  }

  final AppDependencies _dependencies;
  StreamSubscription<AppUser?>? _subscription;

  AppUser? user;
  bool bootstrapping = true;
  bool busy = false;
  bool themeBusy = false;
  String? errorMessage;

  bool get isAuthenticated => user != null;

  bool get mustChangePassword => user?.mustChangePassword == true;

  bool get isDarkTheme => ThemePreference.isDark(user?.theme);

  Future<bool> login({
    required String identifier,
    required String password,
  }) async {
    busy = true;
    errorMessage = null;
    notifyListeners();

    try {
      user = await _dependencies.loginUseCase.execute(
        identifier: identifier,
        password: password,
      );
      return true;
    } on DomainException catch (error) {
      errorMessage = error.message;
      return false;
    } catch (_) {
      errorMessage = 'No se pudo iniciar sesión';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> changePassword({
    required String newPassword,
    required String confirmPassword,
  }) async {
    final current = user;
    if (current == null) return false;

    busy = true;
    errorMessage = null;
    notifyListeners();

    try {
      user = await _dependencies.changeOwnPasswordUseCase.execute(
        actor: current,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      );
      return true;
    } on DomainException catch (error) {
      errorMessage = error.message;
      return false;
    } catch (_) {
      errorMessage = 'No se pudo actualizar la contraseña';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> toggleTheme() async {
    final current = user;
    if (current == null || themeBusy) return false;

    final previousTheme = current.theme;
    final nextTheme = ThemePreference.toggle(previousTheme);

    user = current.copyWith(theme: nextTheme);
    themeBusy = true;
    notifyListeners();

    try {
      user = await _dependencies.updateOwnThemeUseCase.execute(
        current,
        nextTheme,
      );
      return true;
    } on DomainException catch (error) {
      user = current.copyWith(theme: previousTheme);
      errorMessage = error.message;
      return false;
    } catch (_) {
      user = current.copyWith(theme: previousTheme);
      errorMessage = 'No se pudo cambiar el tema';
      return false;
    } finally {
      themeBusy = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _dependencies.logoutUseCase.execute();
    user = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
