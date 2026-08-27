import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/field_task.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/task_repository.dart';

class FirebaseTaskRepository implements TaskRepository {
  FirebaseTaskRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _tasks =>
      _firestore.collection('tasks');

  double? _coord(dynamic value) {
    if (value is num) {
      final next = value.toDouble();
      return next.isFinite ? next : null;
    }
    if (value is String) {
      final next = double.tryParse(value.trim());
      if (next != null && next.isFinite) return next;
    }
    return null;
  }

  TaskRoute _mapRoute(Map<String, dynamic> data) {
    final latitude = _coord(data['latitude']);
    final longitude = _coord(data['longitude']);
    final hasPoint = latitude != null &&
        longitude != null &&
        !(latitude == 0 && longitude == 0);
    return TaskRoute(
      routeCode: ((data['routeCode'] as String?) ?? '').replaceAll(RegExp(r'\D'), ''),
      latitude: hasPoint ? latitude : null,
      longitude: hasPoint ? longitude : null,
      note: (data['note'] as String?) ?? '',
      completed: data['completed'] == true,
      completedById: (data['completedById'] as String?) ?? '',
      completedByName: (data['completedByName'] as String?) ?? '',
      completedAt: (data['completedAt'] as Timestamp?)?.toDate(),
      claimedById: (data['claimedById'] as String?) ?? '',
      claimedByName: (data['claimedByName'] as String?) ?? '',
      claimedAt: (data['claimedAt'] as Timestamp?)?.toDate(),
      photosUploaded: data['photosUploaded'] == true,
    );
  }

  TaskNotice? _mapNotice(dynamic raw) {
    if (raw is! Map) return null;
    final data = Map<String, dynamic>.from(raw);
    final message = (data['message'] as String?) ?? '';
    if (message.isEmpty) return null;
    return TaskNotice(
      message: message,
      routeCode: (data['routeCode'] as String?) ?? '',
      createdById: (data['createdById'] as String?) ?? '',
      createdByName: (data['createdByName'] as String?) ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  Map<String, dynamic> _serializeRoute(TaskRoute route) {
    final payload = <String, dynamic>{
      'routeCode': route.routeCode,
      'note': route.note,
      'completed': route.completed,
      'completedById': route.completedById,
      'completedByName': route.completedByName,
      'completedAt': route.completedAt == null
          ? null
          : Timestamp.fromDate(route.completedAt!),
      'claimedById': route.claimedById,
      'claimedByName': route.claimedByName,
      'claimedAt': route.claimedAt == null
          ? null
          : Timestamp.fromDate(route.claimedAt!),
      'photosUploaded': route.photosUploaded,
    };
    if (route.hasMapPoint) {
      payload['latitude'] = route.latitude;
      payload['longitude'] = route.longitude;
    }
    return payload;
  }

  FieldTask _map(String id, Map<String, dynamic> data) {
    final rawRoutes = (data['routes'] as List?) ?? const [];
    final routes = rawRoutes
        .whereType<Map>()
        .map((item) => _mapRoute(Map<String, dynamic>.from(item)))
        .where((route) => route.routeCode.isNotEmpty)
        .toList();
    final latitude = _coord(data['latitude']);
    final longitude = _coord(data['longitude']);
    final task = FieldTask(
      id: id,
      title: (data['title'] as String?) ?? '',
      description: (data['description'] as String?) ?? '',
      status: (data['status'] as String?) ?? 'PENDIENTE',
      dueDate: (data['dueDate'] as Timestamp?)?.toDate(),
      areaId: (data['areaId'] as String?) ?? '',
      areaName: (data['areaName'] as String?) ?? '',
      routeCode: (data['routeCode'] as String?) ?? '',
      latitude: latitude,
      longitude: longitude,
      routes: routes,
      lastNotice: _mapNotice(data['lastNotice']),
      assignToAllTechnicians: data['assignToAllTechnicians'] == true,
      assignedTechnicianIds: List<String>.from(
        (data['assignedTechnicianIds'] as List?) ?? const [],
      ),
      assignedTechnicianNames: List<String>.from(
        (data['assignedTechnicianNames'] as List?) ?? const [],
      ),
      createdById: (data['createdById'] as String?) ?? '',
      createdByName: (data['createdByName'] as String?) ?? '',
      completedAt: (data['completedAt'] as Timestamp?)?.toDate(),
      completedById: (data['completedById'] as String?) ?? '',
      completedByName: (data['completedByName'] as String?) ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
    return FieldTask(
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
      areaId: task.areaId,
      areaName: task.areaName,
      routeCode: task.normalizedRoutes.isEmpty
          ? task.routeCode
          : task.normalizedRoutes.first.routeCode,
      latitude: task.normalizedRoutes.isEmpty
          ? task.latitude
          : task.normalizedRoutes.first.latitude,
      longitude: task.normalizedRoutes.isEmpty
          ? task.longitude
          : task.normalizedRoutes.first.longitude,
      routes: task.normalizedRoutes,
      lastNotice: task.lastNotice,
      assignToAllTechnicians: task.assignToAllTechnicians,
      assignedTechnicianIds: task.assignedTechnicianIds,
      assignedTechnicianNames: task.assignedTechnicianNames,
      createdById: task.createdById,
      createdByName: task.createdByName,
      completedAt: task.completedAt,
      completedById: task.completedById,
      completedByName: task.completedByName,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    );
  }

  List<FieldTask> _merge(Iterable<QueryDocumentSnapshot<Map<String, dynamic>>> docs) {
    final byId = <String, FieldTask>{};
    for (final doc in docs) {
      byId[doc.id] = _map(doc.id, doc.data());
    }
    final list = byId.values.toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return list;
  }

  @override
  Future<List<FieldTask>> listAccessibleForUser(String userId) async {
    final assigned = await _tasks
        .where('assignedTechnicianIds', arrayContains: userId)
        .get();
    final allTechs = await _tasks
        .where('assignToAllTechnicians', isEqualTo: true)
        .get();
    return _merge([...assigned.docs, ...allTechs.docs]);
  }

  @override
  Stream<List<FieldTask>> watchAccessibleForUser(String userId) {
    final controller = StreamController<List<FieldTask>>();
    var assigned = <QueryDocumentSnapshot<Map<String, dynamic>>>[];
    var allTechs = <QueryDocumentSnapshot<Map<String, dynamic>>>[];

    void emit() {
      if (controller.isClosed) return;
      controller.add(_merge([...assigned, ...allTechs]));
    }

    final subAssigned = _tasks
        .where('assignedTechnicianIds', arrayContains: userId)
        .snapshots()
        .listen((snapshot) {
      assigned = snapshot.docs;
      emit();
    }, onError: controller.addError);
    final subAll = _tasks
        .where('assignToAllTechnicians', isEqualTo: true)
        .snapshots()
        .listen((snapshot) {
      allTechs = snapshot.docs;
      emit();
    }, onError: controller.addError);

    controller.onCancel = () async {
      await subAssigned.cancel();
      await subAll.cancel();
    };
    return controller.stream;
  }

  @override
  Future<List<FieldTask>> listAll() async {
    final snapshot = await _tasks.get();
    final list = snapshot.docs
        .map((doc) => _map(doc.id, doc.data()))
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return list;
  }

  @override
  Future<FieldTask> create(CreateFieldTaskInput input) async {
    final id = _firestore.collection('tasks').doc().id;
    final now = Timestamp.now();
    final payload = <String, dynamic>{
      'title': input.title,
      'description': input.description,
      'status': 'PENDIENTE',
      'dueDate':
          input.dueDate == null ? null : Timestamp.fromDate(input.dueDate!),
      'areaId': input.areaId,
      'areaName': input.areaName,
      'routeCode': input.routeCode,
      'routes': input.routes.map(_serializeRoute).toList(),
      'assignToAllTechnicians': input.assignToAllTechnicians,
      'assignedTechnicianIds': input.assignedTechnicianIds,
      'assignedTechnicianNames': input.assignedTechnicianNames,
      'createdById': input.createdById,
      'createdByName': input.createdByName,
      'completedAt': null,
      'completedById': '',
      'completedByName': '',
      'createdAt': now,
      'updatedAt': now,
    };
    if (input.latitude != null && input.longitude != null) {
      payload['latitude'] = input.latitude;
      payload['longitude'] = input.longitude;
    }
    await _tasks.doc(id).set(payload);
    return _map(id, payload);
  }

  @override
  Future<FieldTask?> getById(String id) async {
    final snapshot = await _tasks.doc(id).get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    return _map(snapshot.id, snapshot.data()!);
  }

  @override
  Future<FieldTask> update(String id, UpdateFieldTaskInput input) async {
    final ref = _tasks.doc(id);
    final snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data() == null) {
      throw DomainException('Tarea no encontrada');
    }
    final current = _map(id, snapshot.data()!);
    final patch = _buildPatch(current, input);
    await _commitPatch(ref, patch);
    return _map(id, {...snapshot.data()!, ...patch});
  }

  @override
  Future<FieldTask> transact(
    String id,
    UpdateFieldTaskInput Function(FieldTask current) builder,
  ) async {
    final ref = _tasks.doc(id);
    try {
      return await _firestore.runTransaction((transaction) async {
        final snapshot = await transaction.get(ref);
        if (!snapshot.exists || snapshot.data() == null) {
          throw DomainException('Tarea no encontrada');
        }
        final current = _map(id, snapshot.data()!);
        final input = builder(current);
        final patch = _buildPatch(current, input);
        transaction.update(ref, patch);
        return _map(id, {...snapshot.data()!, ...patch});
      });
    } on DomainException {
      rethrow;
    } on FirebaseException catch (error) {
      throw _mapWriteError(error);
    }
  }

  Map<String, dynamic> _buildPatch(
    FieldTask current,
    UpdateFieldTaskInput input,
  ) {
    final routes = input.routes ?? current.normalizedRoutes;
    final primary = routes.isEmpty ? null : routes.first;
    final patch = <String, dynamic>{
      if (input.status != null) 'status': input.status,
      'routes': routes.map(_serializeRoute).toList(),
      'updatedAt': Timestamp.now(),
    };

    if (primary != null && primary.hasMapPoint) {
      patch['latitude'] = primary.latitude;
      patch['longitude'] = primary.longitude;
    }

    if (input.lastNotice != null) {
      patch['lastNotice'] = {
        'message': input.lastNotice!.message,
        'routeCode': input.lastNotice!.routeCode,
        'createdById': input.lastNotice!.createdById,
        'createdByName': input.lastNotice!.createdByName,
        'createdAt': Timestamp.fromDate(input.lastNotice!.createdAt),
      };
    }
    if (input.clearCompletedAt) {
      patch['completedAt'] = null;
      patch['completedById'] = '';
      patch['completedByName'] = '';
    } else {
      if (input.completedAt != null) {
        patch['completedAt'] = Timestamp.fromDate(input.completedAt!);
      }
      if (input.completedById != null && input.completedById!.isNotEmpty) {
        patch['completedById'] = input.completedById;
      }
      if (input.completedByName != null &&
          input.completedByName!.isNotEmpty) {
        patch['completedByName'] = input.completedByName;
      }
    }
    return patch;
  }

  Future<void> _commitPatch(
    DocumentReference<Map<String, dynamic>> ref,
    Map<String, dynamic> patch,
  ) async {
    try {
      await ref.update(patch);
    } on FirebaseException catch (error) {
      throw _mapWriteError(error);
    }
  }

  Never _mapWriteError(FirebaseException error) {
    if (error.code == 'permission-denied') {
      throw DomainException(
        'No se pudo guardar el avance. Vuelve a intentar.',
      );
    }
    throw DomainException('No se pudo actualizar la tarea');
  }
}
