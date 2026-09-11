import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/app_user.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/user_repository.dart';
import '../../domain/value_objects/theme_preference.dart';
import '../../domain/value_objects/user_role.dart';
import 'firestore_client.dart';

class FirebaseUserRepository implements UserRepository {
  FirebaseUserRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _users =>
      _firestore.collection('users');

  @override
  Future<AppUser?> getById(String id) async {
    try {
      final snapshot = await getFast(
        _users.doc(id),
        timeout: const Duration(seconds: 8),
      );
      if (!snapshot.exists || snapshot.data() == null) return null;
      return _map(id, snapshot.data()!);
    } on DomainException {
      rethrow;
    } catch (_) {
      throw DomainException(
        'Red lenta al leer tu perfil. Intenta de nuevo.',
      );
    }
  }

  @override
  Future<List<AppUser>> listTechnicians() async {
    try {
      final results = await Future.wait([
        queryFast(
          _users.where('roles', arrayContains: 'TECNICO'),
          timeout: const Duration(seconds: 10),
        ),
        queryFast(
          _users.where('role', isEqualTo: 'TECNICO'),
          timeout: const Duration(seconds: 10),
        ),
      ]);
      final byArray = results[0];
      final byRole = results[1];
      final byId = <String, AppUser>{};
      for (final doc in [...byArray.docs, ...byRole.docs]) {
        try {
          final user = _map(doc.id, doc.data());
          if (user.active) byId[user.id] = user;
        } catch (_) {
          // Perfil mal formado.
        }
      }
      final unique = <String, AppUser>{};
      for (final user in byId.values) {
        final key =
            user.accessDni.isNotEmpty ? 'dni:${user.accessDni}' : 'id:${user.id}';
        final previous = unique[key];
        if (previous == null || user.updatedAt.isAfter(previous.updatedAt)) {
          unique[key] = user;
        }
      }
      final users = unique.values.toList()
        ..sort((a, b) => a.displayName.compareTo(b.displayName));
      return users;
    } on DomainException {
      rethrow;
    } on TimeoutException {
      throw DomainException(
        'La red está lenta al cargar técnicos. Intenta de nuevo.',
      );
    }
  }

  @override
  Future<AppUser> updateMustChangePassword({
    required String userId,
    required bool mustChangePassword,
    String? loginSecret,
  }) async {
    final ref = _users.doc(userId);
    final existing = await getFast(ref, timeout: const Duration(seconds: 6));
    if (!existing.exists || existing.data() == null) {
      throw DomainException('Usuario no encontrado');
    }

    final now = Timestamp.now();
    final patch = <String, dynamic>{
      'mustChangePassword': mustChangePassword,
      'updatedAt': now,
    };
    if (loginSecret != null) {
      patch['loginSecret'] = loginSecret;
    }
    await ref.update(patch);

    final data = Map<String, dynamic>.from(existing.data()!);
    data['mustChangePassword'] = mustChangePassword;
    if (loginSecret != null) data['loginSecret'] = loginSecret;
    data['updatedAt'] = now;
    return _map(userId, data);
  }

  @override
  Future<AppUser> updateTheme({
    required String userId,
    required String theme,
  }) async {
    final ref = _users.doc(userId);
    final existing = await getFast(ref, timeout: const Duration(seconds: 6));
    if (!existing.exists || existing.data() == null) {
      throw DomainException('Usuario no encontrado');
    }

    final nextTheme = ThemePreference.normalize(theme);
    final now = Timestamp.now();
    await ref.update({
      'theme': nextTheme,
      'updatedAt': now,
    });

    final data = Map<String, dynamic>.from(existing.data()!);
    data['theme'] = nextTheme;
    data['updatedAt'] = now;
    return _map(userId, data);
  }

  AppUser _map(String id, Map<String, dynamic> data) {
    final rawRoles = data['roles'];
    final parsed = rawRoles is List ? normalizeUserRoles(rawRoles) : <UserRole>[];
    final fallback =
        UserRole.tryParse(data['role'] as String?) ?? UserRole.tecnico;
    final assigned =
        parsed.isNotEmpty ? parsed : normalizeUserRoles([fallback.firestoreValue]);
    final role = primaryUserRole(assigned) ?? fallback;

    return AppUser(
      id: id,
      email: data['email'] as String? ?? '',
      displayName: data['displayName'] as String? ?? '',
      dni: data['dni'] as String? ?? '',
      role: role,
      roles: assigned,
      theme: ThemePreference.normalize(data['theme'] as String?),
      mustChangePassword: data['mustChangePassword'] == true,
      active: data['active'] as bool? ?? false,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
