class FieldTask {
  const FieldTask({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.dueDate,
    required this.areaId,
    required this.areaName,
    required this.routeCode,
    this.latitude,
    this.longitude,
    required this.assignToAllTechnicians,
    required this.assignedTechnicianIds,
    required this.assignedTechnicianNames,
    required this.createdById,
    required this.createdByName,
    required this.completedAt,
    required this.completedById,
    required this.completedByName,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String title;
  final String description;
  final String status;
  final DateTime? dueDate;
  final String areaId;
  final String areaName;
  final String routeCode;
  final double? latitude;
  final double? longitude;
  final bool assignToAllTechnicians;
  final List<String> assignedTechnicianIds;
  final List<String> assignedTechnicianNames;
  final String createdById;
  final String createdByName;
  final DateTime? completedAt;
  final String completedById;
  final String completedByName;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get hasStoredMapPoint =>
      latitude != null &&
      longitude != null &&
      latitude!.isFinite &&
      longitude!.isFinite;

  bool get isPending => status == 'PENDIENTE';
  bool get isInProgress => status == 'EN_PROGRESO';
  bool get isCompleted => status == 'COMPLETADA';

  String get statusLabel {
    switch (status) {
      case 'EN_PROGRESO':
        return 'En progreso';
      case 'COMPLETADA':
        return 'Completada';
      case 'PENDIENTE':
      default:
        return 'Pendiente';
    }
  }
}
