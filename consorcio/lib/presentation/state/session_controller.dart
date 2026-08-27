import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/app_user.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/value_objects/theme_preference.dart';
import '../../domain/value_objects/user_role.dart';

const _activeRoleKey = 'consorcio-active-role';

class SessionController extends ChangeNotifier {
  SessionController(this._dependencies) {
    _subscription = _dependencies.observeSessionUseCase.execute().listen((
      nextUser,
    ) {
      unawaited(_onSession(nextUser));
    });
  }

  final AppDependencies _dependencies;
  StreamSubscription<AppUser?>? _subscription;

  AppUser? user;
  bool bootstrapping = true;
  bool busy = false;
  bool themeBusy = false;
  bool pendingRolePick = false;
  bool _loginInFlight = false;
  String? errorMessage;

  bool get isAuthenticated => user != null && !pendingRolePick;

  bool get mustChangePassword => user?.mustChangePassword == true;

  bool get isDarkTheme => ThemePreference.isDark(user?.theme);

  Future<void> _onSession(AppUser? nextUser) async {
    if (_loginInFlight) {
      bootstrapping = false;
      notifyListeners();
      return;
    }

    if (nextUser == null) {
      user = null;
      pendingRolePick = false;
      bootstrapping = false;
      notifyListeners();
      return;
    }

    if (pendingRolePick && user != null && user!.id == nextUser.id) {
      bootstrapping = false;
      notifyListeners();
      return;
    }

    final applied = await _applyActiveRole(nextUser);
    user = applied.$1;
    pendingRolePick = applied.$2;
    bootstrapping = false;
    notifyListeners();
  }

  /// Si hay dos roles móviles y no hay elección, pide el rol antes de entrar.
  Future<(AppUser, bool)> _applyActiveRole(AppUser nextUser) async {
    final mobile = nextUser.mobileRoles;
    if (mobile.isEmpty) {
      return (nextUser, false);
    }
    if (mobile.length == 1) {
      await _persistRole(mobile.first);
      return (nextUser.copyWith(role: mobile.first), false);
    }
    final stored = await _readStoredRole();
    if (stored != null && mobile.contains(stored)) {
      return (nextUser.copyWith(role: stored), false);
    }
    return (nextUser, true);
  }

  Future<UserRole?> _readStoredRole() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return UserRole.tryParse(prefs.getString(_activeRoleKey));
    } catch (_) {
      return null;
    }
  }

  Future<void> _persistRole(UserRole role) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_activeRoleKey, role.firestoreValue);
    } catch (_) {
      // Sin persistencia local: el rol queda en memoria.
    }
  }

  Future<void> _clearStoredRole() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_activeRoleKey);
    } catch (_) {}
  }

  Future<bool> login({
    required String identifier,
    required String password,
  }) async {
    busy = true;
    errorMessage = null;
    pendingRolePick = false;
    _loginInFlight = true;
    notifyListeners();

    try {
      await _clearStoredRole();
      final logged = await _dependencies.loginUseCase.execute(
        identifier: identifier,
        password: password,
      );
      final mobile = logged.mobileRoles;
      if (mobile.length > 1) {
        user = logged;
        pendingRolePick = true;
        return true;
      }
      final role = mobile.first;
      await _persistRole(role);
      user = logged.copyWith(role: role);
      pendingRolePick = false;
      return true;
    } on DomainException catch (error) {
      errorMessage = error.message;
      return false;
    } catch (_) {
      errorMessage = 'No se pudo iniciar sesión';
      return false;
    } finally {
      _loginInFlight = false;
      busy = false;
      notifyListeners();
    }
  }

  Future<void> selectActiveRole(UserRole role) async {
    final current = user;
    if (current == null) return;
    if (!current.mobileRoles.contains(role)) return;
    await _persistRole(role);
    user = current.copyWith(role: role);
    pendingRolePick = false;
    notifyListeners();
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
      user = user?.copyWith(role: current.role);
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
      final updated = await _dependencies.updateOwnThemeUseCase.execute(
        current,
        nextTheme,
      );
      user = updated.copyWith(role: current.role, roles: current.roles);
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
    await _clearStoredRole();
    await _dependencies.logoutUseCase.execute();
    user = null;
    pendingRolePick = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
