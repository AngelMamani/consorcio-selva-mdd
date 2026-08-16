class Area {
  const Area({
    required this.id,
    required this.name,
    required this.description,
    required this.createdById,
    required this.createdByName,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String description;
  final String createdById;
  final String createdByName;
  final DateTime createdAt;
  final DateTime updatedAt;
}
