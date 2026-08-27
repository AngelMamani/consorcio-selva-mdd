import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/app_user.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/user_repository.dart';
import '../../domain/value_objects/theme_preference.dart';
import '../../domain/value_objects/user_role.dart';

class FirebaseUserRepository implements UserRepository {
  FirebaseUserRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _users =>
      _firestore.collection('users');

  @override
  Future<AppUser?> getById(String id) async {
    final snapshot = await _users.doc(id).get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    return _map(id, snapshot.data()!);
  }

  @override
  Future<List<AppUser>> listTechnicians() async {
    final byRole = await _users.where('role', isEqualTo: 'TECNICO').get();
    final byArray =
        await _users.where('roles', arrayContains: 'TECNICO').get();
    final byId = <String, AppUser>{};
    for (final doc in [...byRole.docs, ...byArray.docs]) {
      try {
        final user = _map(doc.id, doc.data());
        if (user.active) byId[user.id] = user;
      } catch (_) {
        // Perfil mal formado.
      }
    }
    final unique = <String, AppUser>{};
    for (final user in byId.values) {
      final key = user.accessDni.isNotEmpty ? 'dni:${user.accessDni}' : 'id:${user.id}';
      final previous = unique[key];
      if (previous == null || user.updatedAt.isAfter(previous.updatedAt)) {
        unique[key] = user;
      }
    }
    final users = unique.values.toList()
      ..sort((a, b) => a.displayName.compareTo(b.displayName));
    return users;
  }

  @override
  Future<AppUser> updateMustChangePassword({
    required String userId,
    required bool mustChangePassword,
  }) async {
    final ref = _users.doc(userId);
    final existing = await ref.get();
    if (!existing.exists || existing.data() == null) {
      throw DomainException('Usuario no encontrado');
    }

    await ref.update({
      'mustChangePassword': mustChangePassword,
      'updatedAt': Timestamp.now(),
    });

    final updated = await ref.get();
    return _map(userId, updated.data()!);
  }

  @override
  Future<AppUser> updateTheme({
    required String userId,
    required String theme,
  }) async {
    final ref = _users.doc(userId);
    final existing = await ref.get();
    if (!existing.exists || existing.data() == null) {
      throw DomainException('Usuario no encontrado');
    }

    final nextTheme = ThemePreference.normalize(theme);
    await ref.update({
      'theme': nextTheme,
      'updatedAt': Timestamp.now(),
    });

    final updated = await ref.get();
    return _map(userId, updated.data()!);
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
