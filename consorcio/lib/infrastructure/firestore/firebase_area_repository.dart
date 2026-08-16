import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/area.dart';
import '../../domain/repositories/area_repository.dart';

class FirebaseAreaRepository implements AreaRepository {
  FirebaseAreaRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _areas =>
      _firestore.collection('areas');

  @override
  Future<List<Area>> listAll() async {
    final snapshot = await _areas.orderBy('name').get();
    return snapshot.docs.map((doc) => _map(doc.id, doc.data())).toList();
  }

  @override
  Future<Area?> getById(String id) async {
    final snapshot = await _areas.doc(id).get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    return _map(snapshot.id, snapshot.data()!);
  }

  Area _map(String id, Map<String, dynamic> data) {
    return Area(
      id: id,
      name: data['name'] as String? ?? '',
      description: data['description'] as String? ?? '',
      createdById: data['createdById'] as String? ?? '',
      createdByName: data['createdByName'] as String? ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
