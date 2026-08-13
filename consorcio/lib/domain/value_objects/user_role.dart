enum UserRole {
  administrador,
  tecnico;

  static UserRole fromString(String value) {
    switch (value) {
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
      case UserRole.administrador:
        return 'ADMINISTRADOR';
      case UserRole.tecnico:
        return 'TECNICO';
    }
  }

  String get label {
    switch (this) {
      case UserRole.administrador:
        return 'Administrador';
      case UserRole.tecnico:
        return 'Técnico';
    }
  }
}
