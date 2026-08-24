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
    return null;
  }

  FieldTask _map(String id, Map<String, dynamic> data) {
    return FieldTask(
      id: id,
      title: (data['title'] as String?) ?? '',
      description: (data['description'] as String?) ?? '',
      status: (data['status'] as String?) ?? 'PENDIENTE',
      dueDate: (data['dueDate'] as Timestamp?)?.toDate(),
      areaId: (data['areaId'] as String?) ?? '',
      areaName: (data['areaName'] as String?) ?? '',
      routeCode: (data['routeCode'] as String?) ?? '',
      latitude: _coord(data['latitude']),
      longitude: _coord(data['longitude']),
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
  }

  @override
  Future<List<FieldTask>> listAccessibleForUser(String userId) async {
    final assigned = await _tasks
        .where('assignedTechnicianIds', arrayContains: userId)
        .get();
    final allTechs = await _tasks
        .where('assignToAllTechnicians', isEqualTo: true)
        .get();

    final byId = <String, FieldTask>{};
    for (final doc in [...assigned.docs, ...allTechs.docs]) {
      byId[doc.id] = _map(doc.id, doc.data());
    }
    final list = byId.values.toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return list;
  }

  @override
  Future<FieldTask?> getById(String id) async {
    final snapshot = await _tasks.doc(id).get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    return _map(snapshot.id, snapshot.data()!);
  }

  @override
  Future<FieldTask> updateStatus({
    required String id,
    required String status,
    required String completedById,
    required String completedByName,
    DateTime? completedAt,
  }) async {
    final ref = _tasks.doc(id);
    final snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data() == null) {
      throw DomainException('Tarea no encontrada');
    }

    final payload = <String, dynamic>{
      'status': status,
      'completedAt':
          completedAt == null ? null : Timestamp.fromDate(completedAt),
      'completedById': completedById,
      'completedByName': completedByName,
      'updatedAt': Timestamp.now(),
    };
    await ref.update(payload);
    final refreshed = await ref.get();
    return _map(id, refreshed.data()!);
  }
}
