import '../entities/field_task.dart';

abstract class TaskRepository {
  Future<List<FieldTask>> listAccessibleForUser(String userId);
  Future<FieldTask?> getById(String id);
  Future<FieldTask> updateStatus({
    required String id,
    required String status,
    required String completedById,
    required String completedByName,
    DateTime? completedAt,
  });
}
