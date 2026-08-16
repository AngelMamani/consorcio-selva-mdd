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
    final snapshot =
        await _users.where('role', isEqualTo: 'TECNICO').get();
    final users = snapshot.docs
        .map((doc) => _map(doc.id, doc.data()))
        .where((user) => user.active)
        .toList()
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
    return AppUser(
      id: id,
      email: data['email'] as String? ?? '',
      displayName: data['displayName'] as String? ?? '',
      role: UserRole.fromString(data['role'] as String? ?? 'TECNICO'),
      theme: ThemePreference.normalize(data['theme'] as String?),
      mustChangePassword: data['mustChangePassword'] == true,
      active: data['active'] as bool? ?? false,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
