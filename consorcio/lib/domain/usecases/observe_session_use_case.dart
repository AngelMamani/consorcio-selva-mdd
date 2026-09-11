import 'dart:async';

import '../entities/app_user.dart';
import '../errors/domain_exception.dart';
import '../repositories/auth_repository.dart';
import '../repositories/user_repository.dart';

class ObserveSessionUseCase {
  ObserveSessionUseCase(this._authRepository, this._userRepository);

  final AuthRepository _authRepository;
  final UserRepository _userRepository;

  /// Emite el usuario móvil activo. Errores de red se reportan con
  /// [Stream.addError] sin cerrar la escucha de Auth (se puede reintentar).
  Stream<AppUser?> execute() {
    late final StreamController<AppUser?> controller;
    StreamSubscription<String?>? authSub;

    controller = StreamController<AppUser?>(
      onListen: () {
        authSub = _authRepository.observeAuthState().listen(
          (userId) async {
            if (userId == null) {
              if (!controller.isClosed) controller.add(null);
              return;
            }

            try {
              final user = await _userRepository.getById(userId);
              if (user == null || !user.active || user.mobileRoles.isEmpty) {
                await _authRepository.logout();
                if (!controller.isClosed) controller.add(null);
                return;
              }
              if (!controller.isClosed) controller.add(user);
            } on DomainException catch (error) {
              if (!controller.isClosed) controller.addError(error);
            } catch (_) {
              if (!controller.isClosed) {
                controller.addError(
                  DomainException(
                    'Red lenta al leer tu perfil. Intenta de nuevo.',
                  ),
                );
              }
            }
          },
          onError: (Object error, StackTrace stackTrace) {
            if (!controller.isClosed) {
              controller.addError(error, stackTrace);
            }
          },
          onDone: () {
            if (!controller.isClosed) controller.close();
          },
        );
      },
      onCancel: () {
        unawaited(authSub?.cancel());
      },
    );

    return controller.stream;
  }
}
