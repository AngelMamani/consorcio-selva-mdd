enum UserRole {
  superAdministrador,
  administrador,
  tecnico;

  static UserRole fromString(String value) {
    switch (value) {
      case 'SUPER_ADMINISTRADOR':
        return UserRole.superAdministrador;
      case 'ADMINISTRADOR':
        return UserRole.administrador;
      case 'TECNICO':
        return UserRole.tecnico;
      default:
        throw ArgumentError('Rol inválido: $value');
    }
  }

  static UserRole? tryParse(String? value) {
    if (value == null || value.isEmpty) return null;
    try {
      return UserRole.fromString(value);
    } catch (_) {
      return null;
    }
  }

  String get firestoreValue {
    switch (this) {
      case UserRole.superAdministrador:
        return 'SUPER_ADMINISTRADOR';
      case UserRole.administrador:
        return 'ADMINISTRADOR';
      case UserRole.tecnico:
        return 'TECNICO';
    }
  }

  String get label {
    switch (this) {
      case UserRole.superAdministrador:
        return 'Super Administrador';
      case UserRole.administrador:
        return 'Administrador';
      case UserRole.tecnico:
        return 'Técnico';
    }
  }

  String get accessHint {
    switch (this) {
      case UserRole.superAdministrador:
        return 'Solo página web';
      case UserRole.administrador:
        return 'Página web y aplicativo móvil';
      case UserRole.tecnico:
        return 'Solo aplicativo móvil';
    }
  }

  bool get isWeb =>
      this == UserRole.superAdministrador || this == UserRole.administrador;

  bool get isMobile =>
      this == UserRole.administrador || this == UserRole.tecnico;
}

List<UserRole> normalizeUserRoles(Iterable<dynamic> values) {
  final unique = <UserRole>{};
  for (final value in values) {
    final parsed = UserRole.tryParse('$value');
    if (parsed != null) unique.add(parsed);
  }
  return [
    UserRole.superAdministrador,
    UserRole.administrador,
    UserRole.tecnico,
  ].where(unique.contains).take(3).toList();
}

UserRole? primaryUserRole(Iterable<UserRole> roles) {
  if (roles.contains(UserRole.superAdministrador)) {
    return UserRole.superAdministrador;
  }
  if (roles.contains(UserRole.administrador)) {
    return UserRole.administrador;
  }
  if (roles.contains(UserRole.tecnico)) return UserRole.tecnico;
  return null;
}
