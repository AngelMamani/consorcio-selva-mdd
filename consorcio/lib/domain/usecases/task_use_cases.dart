import '../entities/app_user.dart';
import '../entities/field_task.dart';
import '../errors/domain_exception.dart';
import '../repositories/task_repository.dart';

class ListMyTasksUseCase {
  ListMyTasksUseCase(this._taskRepository);

  final TaskRepository _taskRepository;

  Future<List<FieldTask>> execute(AppUser actor) {
    actor.assertCanOperateApp();
    return _taskRepository.listAccessibleForUser(actor.id);
  }
}

class StartMyTaskUseCase {
  StartMyTaskUseCase(this._taskRepository);

  final TaskRepository _taskRepository;

  Future<FieldTask> execute(AppUser actor, String taskId) async {
    actor.assertCanOperateApp();
    final existing = await _taskRepository.getById(taskId);
    if (existing == null) {
      throw DomainException('Tarea no encontrada');
    }
    if (existing.isCompleted) {
      throw DomainException('La tarea ya está completada');
    }
    if (existing.isInProgress) return existing;
    return _taskRepository.updateStatus(
      id: taskId,
      status: 'EN_PROGRESO',
      completedById: '',
      completedByName: '',
      completedAt: null,
    );
  }
}

class CompleteMyTaskUseCase {
  CompleteMyTaskUseCase(this._taskRepository);

  final TaskRepository _taskRepository;

  Future<FieldTask> execute(AppUser actor, String taskId) async {
    actor.assertCanOperateApp();
    final existing = await _taskRepository.getById(taskId);
    if (existing == null) {
      throw DomainException('Tarea no encontrada');
    }
    if (existing.isCompleted) return existing;
    return _taskRepository.updateStatus(
      id: taskId,
      status: 'COMPLETADA',
      completedById: actor.id,
      completedByName: actor.displayName,
      completedAt: DateTime.now(),
    );
  }
}
