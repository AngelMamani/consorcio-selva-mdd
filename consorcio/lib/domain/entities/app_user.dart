import '../errors/domain_exception.dart';
import '../value_objects/user_role.dart';

class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.displayName,
    required this.role,
    required this.theme,
    required this.mustChangePassword,
    required this.active,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String email;
  final String displayName;
  final UserRole role;
  final String theme;
  final bool mustChangePassword;
  final bool active;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isTechnician => role == UserRole.tecnico && active;

  bool get canOperateApp => isTechnician && !mustChangePassword;

  void assertCanOperateApp() {
    if (!isTechnician) {
      throw DomainException('Solo técnicos activos pueden usar esta función');
    }
    if (mustChangePassword) {
      throw DomainException(
        'Debes cambiar la contraseña temporal antes de continuar',
      );
    }
  }

  AppUser copyWith({
    String? theme,
    bool? mustChangePassword,
    DateTime? updatedAt,
  }) {
    return AppUser(
      id: id,
      email: email,
      displayName: displayName,
      role: role,
      theme: theme ?? this.theme,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      active: active,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
