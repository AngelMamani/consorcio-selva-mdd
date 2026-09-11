import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/auth_repository.dart';
import '../firestore/firestore_client.dart';

class FirebaseAuthRepository implements AuthRepository {
  FirebaseAuthRepository({FirebaseAuth? auth, FirebaseFirestore? firestore})
      : _auth = auth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;

  static String _dniCacheKey(String dni) => 'login_dni_email_$dni';

  @override
  String? get currentUserId => _auth.currentUser?.uid;

  @override
  Future<String> login({
    required String email,
    required String password,
  }) async {
    try {
      final result = await _auth
          .signInWithEmailAndPassword(
            email: email,
            password: password,
          )
          .timeout(const Duration(seconds: 15));
      return result.user!.uid;
    } on FirebaseAuthException catch (error) {
      throw DomainException(_mapAuthError(error));
    } on TimeoutException {
      throw DomainException(
        'La red está lenta. Revisa datos/WiFi e intenta de nuevo.',
      );
    }
  }

  @override
  Future<String> resolveEmailByDni(
    String dni, {
    bool forceRefresh = false,
  }) async {
    final cacheKey = _dniCacheKey(dni);
    if (!forceRefresh) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final cached = prefs.getString(cacheKey)?.trim().toLowerCase();
        if (cached != null && cached.contains('@')) {
          unawaited(_refreshDniEmailCache(dni, cacheKey));
          return cached;
        }
      } catch (_) {}
    }

    final email = await _fetchDniEmail(dni);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(cacheKey, email);
    } catch (_) {}
    return email;
  }

  @override
  Future<void> clearDniEmailCache(String dni) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_dniCacheKey(dni));
    } catch (_) {}
  }

  Future<void> _refreshDniEmailCache(String dni, String cacheKey) async {
    try {
      final email = await _fetchDniEmail(dni);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(cacheKey, email);
    } catch (_) {}
  }

  Future<String> _fetchDniEmail(String dni) async {
    try {
      final snapshot = await getFast(
        _firestore.collection('loginByDni').doc(dni),
        timeout: const Duration(seconds: 8),
      );
      final email = snapshot.data()?['email'];
      if (!snapshot.exists || email is! String || email.trim().isEmpty) {
        throw DomainException('Correo, DNI o contraseña incorrectos');
      }
      return email.trim().toLowerCase();
    } on DomainException {
      rethrow;
    } on TimeoutException {
      throw DomainException(
        'La red está lenta. Revisa datos/WiFi e intenta de nuevo.',
      );
    } on FirebaseException catch (error) {
      if (error.code == 'unavailable' || error.code == 'deadline-exceeded') {
        throw DomainException(
          'La red está lenta. Revisa datos/WiFi e intenta de nuevo.',
        );
      }
      throw DomainException('No se pudo verificar el DNI. Intenta de nuevo.');
    } catch (_) {
      throw DomainException(
        'La red está lenta. Revisa datos/WiFi e intenta de nuevo.',
      );
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
        return 'Correo, DNI o contraseña incorrectos';
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
