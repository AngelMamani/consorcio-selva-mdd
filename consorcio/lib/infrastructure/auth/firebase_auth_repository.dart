import 'package:firebase_auth/firebase_auth.dart';

import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/auth_repository.dart';

class FirebaseAuthRepository implements AuthRepository {
  FirebaseAuthRepository({FirebaseAuth? auth})
      : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;

  @override
  String? get currentUserId => _auth.currentUser?.uid;

  @override
  Future<String> login({
    required String email,
    required String password,
  }) async {
    try {
      final result = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      return result.user!.uid;
    } on FirebaseAuthException catch (error) {
      throw DomainException(_mapAuthError(error));
    }
  }

  @override
  Future<void> logout() => _auth.signOut();

  @override
  Stream<String?> observeAuthState() {
    return _auth.authStateChanges().map((user) => user?.uid);
  }

  @override
  Future<void> updatePassword(String newPassword) async {
    final currentUser = _auth.currentUser;
    if (currentUser == null) {
      throw DomainException(
        'No hay sesión activa para cambiar la contraseña',
      );
    }

    try {
      await currentUser.updatePassword(newPassword);
    } on FirebaseAuthException catch (error) {
      throw DomainException(_mapAuthError(error));
    }
  }

  String _mapAuthError(FirebaseAuthException error) {
    switch (error.code) {
      case 'invalid-credential':
      case 'wrong-password':
      case 'user-not-found':
        return 'Correo o contraseña incorrectos';
      case 'weak-password':
        return 'La contraseña es demasiado débil';
      case 'requires-recent-login':
        return 'Por seguridad, cierra sesión e inicia de nuevo para cambiar la contraseña';
      case 'too-many-requests':
        return 'Demasiados intentos. Espera un momento';
      case 'network-request-failed':
        return 'Sin conexión con Firebase. Revisa tu internet e intenta otra vez';
      case 'invalid-api-key':
      case 'app-not-authorized':
        return 'La app no está bien registrada en Firebase. Contacta al administrador';
      default:
        return error.message ?? 'Error de autenticación';
    }
  }
}