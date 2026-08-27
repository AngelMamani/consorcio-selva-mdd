class TaskRoute {
  const TaskRoute({
    required this.routeCode,
    this.latitude,
    this.longitude,
    this.note = '',
    this.completed = false,
    this.completedById = '',
    this.completedByName = '',
    this.completedAt,
    this.claimedById = '',
    this.claimedByName = '',
    this.claimedAt,
    this.photosUploaded = false,
  });

  final String routeCode;
  final double? latitude;
  final double? longitude;
  final String note;
  final bool completed;
  final String completedById;
  final String completedByName;
  final DateTime? completedAt;
  final String claimedById;
  final String claimedByName;
  final DateTime? claimedAt;
  final bool photosUploaded;

  bool get hasMapPoint {
    final lat = latitude;
    final lng = longitude;
    return lat != null &&
        lng != null &&
        lat.isFinite &&
        lng.isFinite &&
        !(lat == 0 && lng == 0);
  }

  bool get isClaimed => claimedById.trim().isNotEmpty;

  bool isClaimedBy(String userId) =>
      isClaimed && claimedById == userId.trim();

  TaskRoute copyWith({
    double? latitude,
    double? longitude,
    bool? completed,
    String? completedById,
    String? completedByName,
    DateTime? completedAt,
    bool clearCompletedAt = false,
    String? claimedById,
    String? claimedByName,
    DateTime? claimedAt,
    bool clearClaim = false,
    bool? photosUploaded,
  }) {
    return TaskRoute(
      routeCode: routeCode,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      note: note,
      completed: completed ?? this.completed,
      completedById: completedById ?? this.completedById,
      completedByName: completedByName ?? this.completedByName,
      completedAt: clearCompletedAt ? null : (completedAt ?? this.completedAt),
      claimedById: clearClaim ? '' : (claimedById ?? this.claimedById),
      claimedByName: clearClaim ? '' : (claimedByName ?? this.claimedByName),
      claimedAt: clearClaim ? null : (claimedAt ?? this.claimedAt),
      photosUploaded: photosUploaded ?? this.photosUploaded,
    );
  }
}

class TaskNotice {
  const TaskNotice({
    required this.message,
    required this.routeCode,
    required this.createdById,
    required this.createdByName,
    required this.createdAt,
  });

  final String message;
  final String routeCode;
  final String createdById;
  final String createdByName;
  final DateTime createdAt;
}

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
    required this.routes,
    this.lastNotice,
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
  final List<TaskRoute> routes;
  final TaskNotice? lastNotice;
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

  List<TaskRoute> get normalizedRoutes {
    if (routes.isNotEmpty) return routes;
    final code = routeCode.trim();
    if (code.isEmpty) return const [];
    return [
      TaskRoute(
        routeCode: code,
        latitude: latitude,
        longitude: longitude,
        completed: isCompleted,
        completedById: isCompleted ? completedById : '',
        completedByName: isCompleted ? completedByName : '',
        completedAt: isCompleted ? completedAt : null,
      ),
    ];
  }

  bool get hasStoredMapPoint => normalizedRoutes.any((route) => route.hasMapPoint);

  bool get isPending => status == 'PENDIENTE';
  bool get isInProgress => status == 'EN_PROGRESO';
  bool get isCompleted => status == 'COMPLETADA';

  bool get allRoutesCompleted =>
      normalizedRoutes.isNotEmpty &&
      normalizedRoutes.every((route) => route.completed);

  String get routesLabel {
    final items = normalizedRoutes;
    if (items.isEmpty) return 'Sin rutas';
    if (items.length == 1) return 'Suministro ${items.first.routeCode}';
    return '${items.length} rutas';
  }

  bool get isJointAssignment =>
      assignToAllTechnicians || assignedTechnicianIds.length > 1;

  String get assigneesLabel {
    if (assignToAllTechnicians) return 'Todos los técnicos';
    if (assignedTechnicianNames.isEmpty) return 'Sin asignar';
    if (assignedTechnicianNames.length == 1) {
      return assignedTechnicianNames.first;
    }
    if (assignedTechnicianNames.length == 2) {
      return assignedTechnicianNames.join(', ');
    }
    return '${assignedTechnicianNames.first} +${assignedTechnicianNames.length - 1}';
  }

  String get jointAssignmentLabel {
    if (!isJointAssignment) return assigneesLabel;
    return 'En conjunto · $assigneesLabel';
  }

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
