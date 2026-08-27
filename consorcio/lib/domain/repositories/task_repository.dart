import '../entities/field_task.dart';

abstract class TaskRepository {
  Future<List<FieldTask>> listAccessibleForUser(String userId);
  Stream<List<FieldTask>> watchAccessibleForUser(String userId);
  Future<List<FieldTask>> listAll();
  Future<FieldTask?> getById(String id);
  Future<FieldTask> create(CreateFieldTaskInput input);
  Future<FieldTask> update(String id, UpdateFieldTaskInput input);
  Future<FieldTask> transact(
    String id,
    UpdateFieldTaskInput Function(FieldTask current) builder,
  );
}

class CreateFieldTaskInput {
  const CreateFieldTaskInput({
    required this.title,
    required this.description,
    required this.dueDate,
    required this.areaId,
    required this.areaName,
    required this.routeCode,
    this.latitude,
    this.longitude,
    required this.routes,
    required this.assignToAllTechnicians,
    required this.assignedTechnicianIds,
    required this.assignedTechnicianNames,
    required this.createdById,
    required this.createdByName,
  });

  final String title;
  final String description;
  final DateTime? dueDate;
  final String areaId;
  final String areaName;
  final String routeCode;
  final double? latitude;
  final double? longitude;
  final List<TaskRoute> routes;
  final bool assignToAllTechnicians;
  final List<String> assignedTechnicianIds;
  final List<String> assignedTechnicianNames;
  final String createdById;
  final String createdByName;
}

class UpdateFieldTaskInput {
  const UpdateFieldTaskInput({
    this.status,
    this.routes,
    this.lastNotice,
    this.latitude,
    this.longitude,
    this.completedAt,
    this.completedById,
    this.completedByName,
    this.clearCompletedAt = false,
  });

  final String? status;
  final List<TaskRoute>? routes;
  final TaskNotice? lastNotice;
  final double? latitude;
  final double? longitude;
  final DateTime? completedAt;
  final String? completedById;
  final String? completedByName;
  final bool clearCompletedAt;
}
