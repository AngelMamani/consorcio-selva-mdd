import '../value_objects/geo_location.dart';

class ImageFolder {
  const ImageFolder({
    required this.id,
    required this.areaId,
    required this.areaName,
    required this.name,
    required this.description,
    required this.ownerId,
    required this.ownerName,
    required this.assignToAllTechnicians,
    required this.assignedTechnicianIds,
    required this.assignedTechnicianNames,
    required this.imageCount,
    required this.createdAt,
    required this.updatedAt,
    this.location,
    this.routeCode,
  });

  final String id;
  final String areaId;
  final String areaName;
  final String name;
  final String description;
  final String ownerId;
  final String ownerName;
  final bool assignToAllTechnicians;
  final List<String> assignedTechnicianIds;
  final List<String> assignedTechnicianNames;
  final int imageCount;
  final GeoLocation? location;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? routeCode;

  bool get hasLocation => location != null && location!.isValid;

  bool get isSupplyFolder => (routeCode ?? '').isNotEmpty;

  bool canBeAccessedBy(String userId) {
    if (ownerId == userId) return true;
    if (assignToAllTechnicians) return true;
    return assignedTechnicianIds.contains(userId);
  }

  String get assigneesLabel {
    if (assignToAllTechnicians) return 'Todos los técnicos';
    if (assignedTechnicianNames.isEmpty) {
      return ownerName.isEmpty ? 'Sin asignar' : ownerName;
    }
    if (assignedTechnicianNames.length == 1) {
      return assignedTechnicianNames.first;
    }
    if (assignedTechnicianNames.length == 2) {
      return '${assignedTechnicianNames[0]}, ${assignedTechnicianNames[1]}';
    }
    return '${assignedTechnicianNames.first} +${assignedTechnicianNames.length - 1}';
  }
}
