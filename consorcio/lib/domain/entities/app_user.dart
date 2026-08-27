import '../errors/domain_exception.dart';
import '../value_objects/user_role.dart';

class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.displayName,
    this.dni = '',
    required this.role,
    required this.roles,
    required this.theme,
    required this.mustChangePassword,
    required this.active,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String email;
  final String displayName;
  final String dni;
  final UserRole role;
  final List<UserRole> roles;
  final String theme;
  final bool mustChangePassword;
  final bool active;
  final DateTime createdAt;
  final DateTime updatedAt;

  static final _dniPattern = RegExp(r'^\d{8}$');
  static const _technicianDomain = '@tecnicos.consorcio-selva-mdd.firebaseapp.com';

  String get accessDni {
    final digits = dni.replaceAll(RegExp(r'\D'), '');
    if (_dniPattern.hasMatch(digits)) return digits;
    final normalized = email.trim().toLowerCase();
    if (normalized.endsWith(_technicianDomain)) {
      final prefix = normalized.split('@').first;
      if (_dniPattern.hasMatch(prefix)) return prefix;
    }
    return '';
  }

  List<UserRole> get assignedRoles =>
      roles.isNotEmpty ? List<UserRole>.from(roles) : [role];

  List<UserRole> get mobileRoles {
    final seen = <UserRole>{};
    return [
      for (final item in assignedRoles)
        if (item.isMobile && seen.add(item)) item,
    ];
  }

  bool get isTechnician => role == UserRole.tecnico && active;

  bool get isMobileAdmin => role == UserRole.administrador && active;

  bool get canOperateApp =>
      active &&
      !mustChangePassword &&
      (role == UserRole.tecnico || role == UserRole.administrador);

  void assertCanOperateApp() {
    if (!active ||
        (role != UserRole.tecnico && role != UserRole.administrador)) {
      throw DomainException(
        'Solo administradores y técnicos activos pueden usar esta función',
      );
    }
    if (mustChangePassword) {
      throw DomainException(
        'Debes cambiar la contraseña temporal antes de continuar',
      );
    }
  }

  AppUser copyWith({
    UserRole? role,
    List<UserRole>? roles,
    String? theme,
    bool? mustChangePassword,
    DateTime? updatedAt,
  }) {
    return AppUser(
      id: id,
      email: email,
      displayName: displayName,
      dni: dni,
      role: role ?? this.role,
      roles: roles ?? this.roles,
      theme: theme ?? this.theme,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      active: active,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
