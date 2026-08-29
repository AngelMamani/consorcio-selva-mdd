class Area {
  const Area({
    required this.id,
    required this.name,
    required this.description,
    this.assignmentMode = 'routes',
    this.reportCode = '',
    required this.createdById,
    required this.createdByName,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String description;
  final String assignmentMode;
  final String reportCode;
  final String createdById;
  final String createdByName;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isWorkOrders {
    if (assignmentMode == 'work_orders') return true;
    if (assignmentMode == 'routes') return false;
    return RegExp(r'instalaci[oó]n', caseSensitive: false).hasMatch(name);
  }
}
