import '../entities/app_user.dart';
import '../entities/field_task.dart';
import '../errors/domain_exception.dart';
import '../repositories/area_repository.dart';
import '../repositories/supply_repository.dart';
import '../repositories/task_repository.dart';
import '../repositories/user_repository.dart';
import '../value_objects/user_role.dart';
import 'search_supplies_use_case.dart';

class ListMyTasksUseCase {
  ListMyTasksUseCase(this._taskRepository);

  final TaskRepository _taskRepository;

  Future<List<FieldTask>> execute(AppUser actor) {
    actor.assertCanOperateApp();
    return _taskRepository.listAccessibleForUser(actor.id);
  }

  Stream<List<FieldTask>> watch(AppUser actor) {
    actor.assertCanOperateApp();
    return _taskRepository.watchAccessibleForUser(actor.id);
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
    return _taskRepository.update(
      taskId,
      UpdateFieldTaskInput(
        status: 'EN_PROGRESO',
        routes: existing.normalizedRoutes,
        completedById: '',
        completedByName: '',
        clearCompletedAt: true,
      ),
    );
  }
}

String _clipName(String value) {
  final trimmed = value.trim();
  if (trimmed.length <= 120) return trimmed;
  return trimmed.substring(0, 120);
}

TaskNotice _notice(AppUser actor, String message, [String routeCode = '']) {
  return TaskNotice(
    message: message.length > 280 ? message.substring(0, 280) : message,
    routeCode: routeCode,
    createdById: actor.id,
    createdByName: _clipName(actor.displayName),
    createdAt: DateTime.now(),
  );
}

List<TaskRoute> _markAllCompleted(List<TaskRoute> routes, AppUser actor) {
  final now = DateTime.now();
  return routes
      .map(
        (route) => route.completed
            ? route
            : route.copyWith(
                completed: true,
                completedById: actor.id,
                completedByName: _clipName(actor.displayName),
                completedAt: now,
              ),
      )
      .toList();
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
    final routes = _markAllCompleted(existing.normalizedRoutes, actor);
    return _taskRepository.update(
      taskId,
      UpdateFieldTaskInput(
        status: 'COMPLETADA',
        routes: routes,
        lastNotice: _notice(
          actor,
          '${actor.displayName} completó la tarea ${existing.title}',
        ),
        completedById: actor.id,
        completedByName: _clipName(actor.displayName),
        completedAt: DateTime.now(),
      ),
    );
  }
}

class CompleteMyTaskRouteUseCase {
  CompleteMyTaskRouteUseCase(this._taskRepository);

  final TaskRepository _taskRepository;

  Future<FieldTask> execute(
    AppUser actor, {
    required String taskId,
    required String routeCode,
  }) async {
    actor.assertCanOperateApp();
    final code = normalizeRouteCode(routeCode);
    return _taskRepository.transact(taskId, (existing) {
      final routes = [...existing.normalizedRoutes];
      final index = routes.indexWhere((route) => route.routeCode == code);
      if (index < 0) {
        throw DomainException('Esa ruta no está en la tarea');
      }
      final current = routes[index];
      if (current.completed) {
        return const UpdateFieldTaskInput();
      }
      if (!current.isClaimedBy(actor.id)) {
        throw DomainException(
          current.isClaimed
              ? 'Este punto ya lo tomó ${current.claimedByName}'
              : 'Primero agarrar este punto para que los demás no vengan',
        );
      }
      if (!current.photosUploaded) {
        throw DomainException(
          'Antes de completar debes mandar las fotos de este punto',
        );
      }
      routes[index] = current.copyWith(
        completed: true,
        completedById: actor.id,
        completedByName: _clipName(actor.displayName),
        completedAt: DateTime.now(),
      );
      final done = routes.every((route) => route.completed);
      return UpdateFieldTaskInput(
        status: done
            ? 'COMPLETADA'
            : existing.isPending
                ? 'EN_PROGRESO'
                : existing.status,
        routes: routes,
        lastNotice: _notice(
          actor,
          '${actor.displayName} completó el suministro $code',
          code,
        ),
        completedById: done ? actor.id : null,
        completedByName: done ? _clipName(actor.displayName) : null,
        completedAt: done ? DateTime.now() : null,
      );
    });
  }
}

class ClaimMyTaskRouteUseCase {
  ClaimMyTaskRouteUseCase(this._taskRepository);

  final TaskRepository _taskRepository;

  Future<FieldTask> execute(
    AppUser actor, {
    required String taskId,
    required String routeCode,
  }) async {
    actor.assertCanOperateApp();
    final code = normalizeRouteCode(routeCode);
    return _taskRepository.transact(taskId, (existing) {
      final routes = [...existing.normalizedRoutes];
      final index = routes.indexWhere((route) => route.routeCode == code);
      if (index < 0) {
        throw DomainException('Esa ruta no está en la tarea');
      }
      final current = routes[index];
      if (current.completed || existing.isCompleted) {
        throw DomainException('Ese punto ya está completado');
      }
      if (current.isClaimedBy(actor.id)) {
        return const UpdateFieldTaskInput();
      }
      if (current.isClaimed) {
        throw DomainException(
          'Este punto ya lo tomó ${current.claimedByName}',
        );
      }
      routes[index] = current.copyWith(
        claimedById: actor.id,
        claimedByName: _clipName(actor.displayName),
        claimedAt: DateTime.now(),
      );
      return UpdateFieldTaskInput(
        status: existing.isPending ? 'EN_PROGRESO' : existing.status,
        routes: routes,
        lastNotice: _notice(
          actor,
          '${actor.displayName} tomó el suministro $code',
          code,
        ),
      );
    });
  }
}

class ReleaseMyTaskRouteUseCase {
  ReleaseMyTaskRouteUseCase(this._taskRepository);

  final TaskRepository _taskRepository;

  Future<FieldTask> execute(
    AppUser actor, {
    required String taskId,
    required String routeCode,
  }) async {
    actor.assertCanOperateApp();
    final code = normalizeRouteCode(routeCode);
    return _taskRepository.transact(taskId, (existing) {
      final routes = [...existing.normalizedRoutes];
      final index = routes.indexWhere((route) => route.routeCode == code);
      if (index < 0) {
        throw DomainException('Esa ruta no está en la tarea');
      }
      final current = routes[index];
      if (current.completed) {
        throw DomainException('Ese punto ya está completado');
      }
      if (!current.isClaimedBy(actor.id)) {
        throw DomainException('Solo puedes soltar un punto que tomaste tú');
      }
      routes[index] = current.copyWith(clearClaim: true);
      return UpdateFieldTaskInput(
        routes: routes,
        lastNotice: _notice(
          actor,
          '${actor.displayName} soltó el suministro $code',
          code,
        ),
      );
    });
  }
}

class MarkMyTaskRoutePhotosUseCase {
  MarkMyTaskRoutePhotosUseCase(this._taskRepository);

  final TaskRepository _taskRepository;

  Future<FieldTask> execute(
    AppUser actor, {
    required String taskId,
    required String routeCode,
  }) async {
    actor.assertCanOperateApp();
    final code = normalizeRouteCode(routeCode);
    return _taskRepository.transact(taskId, (existing) {
      final routes = [...existing.normalizedRoutes];
      final index = routes.indexWhere((route) => route.routeCode == code);
      if (index < 0) {
        throw DomainException('Esa ruta no está en la tarea');
      }
      final current = routes[index];
      if (current.photosUploaded) {
        return const UpdateFieldTaskInput();
      }
      routes[index] = current.copyWith(photosUploaded: true);
      return UpdateFieldTaskInput(routes: routes);
    });
  }
}

class SaveTaskRouteLocationUseCase {
  SaveTaskRouteLocationUseCase(this._taskRepository, this._supplyRepository);

  final TaskRepository _taskRepository;
  final SupplyRepository _supplyRepository;

  Future<FieldTask> execute(
    AppUser actor, {
    required String taskId,
    required String routeCode,
    required double latitude,
    required double longitude,
  }) async {
    actor.assertCanOperateApp();
    if (!latitude.isFinite ||
        !longitude.isFinite ||
        (latitude == 0 && longitude == 0)) {
      throw DomainException('La ubicación GPS no es válida');
    }
    final existing = await _taskRepository.getById(taskId);
    if (existing == null) {
      throw DomainException('Tarea no encontrada');
    }
    final code = normalizeRouteCode(routeCode);
    final routes = [...existing.normalizedRoutes];
    final index = routes.indexWhere((route) => route.routeCode == code);
    if (index < 0) {
      throw DomainException('Esa ruta no está en la tarea');
    }
    if (routes[index].hasMapPoint) return existing;
    try {
      await _supplyRepository.setLocation(
        routeCode: code,
        latitude: latitude,
        longitude: longitude,
      );
    } catch (_) {}
    routes[index] = routes[index].copyWith(
      latitude: latitude,
      longitude: longitude,
    );
    return _taskRepository.update(
      taskId,
      UpdateFieldTaskInput(
        routes: routes,
        lastNotice: _notice(
          actor,
          '${actor.displayName} guardó la ubicación del suministro $code',
          code,
        ),
      ),
    );
  }
}

class ListManagedTasksUseCase {
  ListManagedTasksUseCase(this._taskRepository);

  final TaskRepository _taskRepository;

  Future<List<FieldTask>> execute(AppUser actor) {
    if (!actor.isMobileAdmin) {
      throw DomainException('Solo el administrador puede ver todas las tareas');
    }
    actor.assertCanOperateApp();
    return _taskRepository.listAll();
  }
}

class CreateFieldTaskUseCase {
  CreateFieldTaskUseCase(
    this._taskRepository,
    this._areaRepository,
    this._userRepository,
    this._supplyRepository,
  );

  final TaskRepository _taskRepository;
  final AreaRepository _areaRepository;
  final UserRepository _userRepository;
  final SupplyRepository _supplyRepository;

  Future<List<AppUser>> listTechnicians() {
    return _userRepository.listTechnicians();
  }

  Future<({bool exists, bool hasLocation, String note})> lookupRoute(
    String routeCode,
  ) async {
    final code = normalizeRouteCode(routeCode);
    if (!isRouteCode(code)) {
      throw DomainException('Ingresa un código de suministro válido');
    }
    final supply = await _supplyRepository.getByRouteCode(code);
    if (supply == null) {
      return (exists: false, hasLocation: false, note: '');
    }
    return (
      exists: true,
      hasLocation: supply.hasLocation,
      note: supply.note,
    );
  }

  Future<FieldTask> execute(
    AppUser actor, {
    required String description,
    required String areaId,
    required List<({String routeCode, String note})> routes,
    required bool assignToAllTechnicians,
    required List<String> assignedTechnicianIds,
    DateTime? dueDate,
  }) async {
    if (!actor.isMobileAdmin) {
      throw DomainException('Solo el administrador puede asignar tareas');
    }
    actor.assertCanOperateApp();

    final cleanDescription = description.trim();
    if (cleanDescription.length > 1000) {
      throw DomainException('La descripción no debe superar 1000 caracteres');
    }

    final area = await _areaRepository.getById(areaId.trim());
    if (area == null) {
      throw DomainException('Selecciona una actividad');
    }

    final uniqueRoutes = <TaskRoute>[];
    final seen = <String>{};
    for (final item in routes) {
      final code = normalizeRouteCode(item.routeCode);
      if (!isRouteCode(code) || seen.contains(code)) continue;
      seen.add(code);
      var supply = await _supplyRepository.getByRouteCode(code);
      supply ??= await _supplyRepository.ensureManual(
        routeCode: code,
        note: item.note.trim(),
      );
      uniqueRoutes.add(
        TaskRoute(
          routeCode: code,
          latitude: supply.hasLocation ? supply.latitude : null,
          longitude: supply.hasLocation ? supply.longitude : null,
          note: item.note.trim().isEmpty ? supply.note : item.note.trim(),
        ),
      );
    }
    if (uniqueRoutes.isEmpty) {
      throw DomainException('Agrega al menos una ruta de suministro');
    }

    late final bool assignAll;
    late final List<String> ids;
    late final List<String> names;
    if (assignToAllTechnicians) {
      assignAll = true;
      ids = const [];
      names = const [];
    } else {
      final uniqueIds = <String>{
        ...assignedTechnicianIds.map((id) => id.trim()).where((id) => id.isNotEmpty),
      };
      if (uniqueIds.isEmpty) {
        throw DomainException(
          'Selecciona al menos un técnico o elige “Todos los técnicos”',
        );
      }
      final technicians = await _userRepository.listTechnicians();
      final byId = {
        for (final tech in technicians)
          if (tech.active && tech.assignedRoles.contains(UserRole.tecnico))
            tech.id: tech,
      };
      ids = <String>[];
      names = <String>[];
      for (final id in uniqueIds) {
        final tech = byId[id];
        if (tech == null) {
          throw DomainException(
            'Hay un técnico inválido o inactivo en la asignación',
          );
        }
        ids.add(tech.id);
        names.add(tech.displayName);
      }
      assignAll = false;
    }

    final title = area.name.trim().isEmpty
        ? 'Tarea'
        : (area.name.trim().length > 160
            ? area.name.trim().substring(0, 160)
            : area.name.trim());
    final primary = uniqueRoutes.first;
    return _taskRepository.create(
      CreateFieldTaskInput(
        title: title,
        description: cleanDescription,
        dueDate: dueDate,
        areaId: area.id,
        areaName: area.name,
        routeCode: primary.routeCode,
        latitude: primary.latitude,
        longitude: primary.longitude,
        routes: uniqueRoutes,
        assignToAllTechnicians: assignAll,
        assignedTechnicianIds: ids,
        assignedTechnicianNames: names,
        createdById: actor.id,
        createdByName: actor.displayName,
      ),
    );
  }
}
