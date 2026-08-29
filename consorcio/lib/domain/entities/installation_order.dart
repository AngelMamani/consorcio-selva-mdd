class InstallationOrder {
  const InstallationOrder({
    required this.id,
    required this.areaId,
    required this.areaName,
    required this.orderNumber,
    required this.subType,
    required this.applicantName,
    required this.applicantAddress,
    required this.sectorCijp,
    required this.sector,
    required this.supplyCode,
    required this.neighborRouteCode,
    required this.attentionCenter,
    required this.executionNotes,
    required this.registeredFlag,
    required this.technicianId,
    required this.technicianName,
    required this.scheduledDate,
    required this.status,
  });

  final String id;
  final String areaId;
  final String areaName;
  final String orderNumber;
  final String subType;
  final String applicantName;
  final String applicantAddress;
  final String sectorCijp;
  final String sector;
  final String supplyCode;
  final String neighborRouteCode;
  final String attentionCenter;
  final String executionNotes;
  final String registeredFlag;
  final String technicianId;
  final String technicianName;
  final DateTime? scheduledDate;
  final String status;

  String get registeredFlagLabel =>
      registeredFlag.trim().toUpperCase() == 'SI' ? 'SI' : 'NO';

  bool get isProgrammed => status == 'PROGRAMADO' && technicianId.isNotEmpty;

  String get statusLabel =>
      isProgrammed ? 'PROGRAMADO' : 'NO REGISTRADO';

  String get scheduledDateLabel {
    final date = scheduledDate;
    if (date == null) return '';
    return '${date.day}/${date.month}/${date.year}';
  }
}
