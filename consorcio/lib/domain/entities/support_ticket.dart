class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.kind,
    required this.message,
    required this.status,
    required this.createdById,
    required this.createdByName,
    required this.createdAt,
    this.response = '',
    this.resolvedAt,
    this.resolvedById = '',
    this.resolvedByName = '',
  });

  final String id;
  final String kind;
  final String message;
  final String status;
  final String createdById;
  final String createdByName;
  final DateTime createdAt;
  final String response;
  final DateTime? resolvedAt;
  final String resolvedById;
  final String resolvedByName;

  bool get isOpen => status != 'RESUELTO';
  bool get isProblem => kind == 'PROBLEMA';

  String get kindLabel => isProblem ? 'Problema' : 'Sugerencia';
  String get statusLabel => isOpen ? 'Abierto' : 'Resuelto';
}
