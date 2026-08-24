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
}
