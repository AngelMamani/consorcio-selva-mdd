import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/installation_order.dart';
import '../../domain/repositories/installation_order_repository.dart';

class FirebaseInstallationOrderRepository
    implements InstallationOrderRepository {
  FirebaseInstallationOrderRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _orders =>
      _firestore.collection('installationOrders');

  InstallationOrder _map(String id, Map<String, dynamic> data) {
    final technicianId = (data['technicianId'] as String?) ?? '';
    return InstallationOrder(
      id: id,
      areaId: data['areaId'] as String? ?? '',
      areaName: data['areaName'] as String? ?? '',
      orderNumber: data['orderNumber'] as String? ?? '',
      subType: data['subType'] as String? ?? '',
      applicantName: data['applicantName'] as String? ?? '',
      applicantAddress: data['applicantAddress'] as String? ?? '',
      sectorCijp: data['sectorCijp'] as String? ?? '',
      sector: data['sector'] as String? ?? '',
      supplyCode: data['supplyCode'] as String? ?? '',
      neighborRouteCode: data['neighborRouteCode'] as String? ?? '',
      attentionCenter: data['attentionCenter'] as String? ?? '',
      executionNotes: data['executionNotes'] as String? ?? '',
      registeredFlag: ((data['registeredFlag'] as String?) ?? '').toUpperCase() == 'SI'
          ? 'SI'
          : 'NO',
      technicianId: technicianId,
      technicianName: data['technicianName'] as String? ?? '',
      scheduledDate: (data['scheduledDate'] as Timestamp?)?.toDate(),
      status: technicianId.isNotEmpty ? 'PROGRAMADO' : 'NO_REGISTRADO',
    );
  }

  List<InstallationOrder> _sorted(Iterable<InstallationOrder> orders) {
    final list = orders.toList();
    list.sort((left, right) {
      final leftDate = left.scheduledDate?.millisecondsSinceEpoch ?? 0;
      final rightDate = right.scheduledDate?.millisecondsSinceEpoch ?? 0;
      if (leftDate != rightDate) return leftDate.compareTo(rightDate);
      return left.orderNumber.compareTo(right.orderNumber);
    });
    return list;
  }

  @override
  Stream<List<InstallationOrder>> watchByArea(String areaId) {
    return _orders.where('areaId', isEqualTo: areaId).snapshots().map(
          (snapshot) => _sorted(
            snapshot.docs.map((doc) => _map(doc.id, doc.data())),
          ),
        );
  }

  @override
  Stream<List<InstallationOrder>> watchAssignedTo(String technicianId) {
    return _orders
        .where('technicianId', isEqualTo: technicianId)
        .snapshots()
        .map(
          (snapshot) => _sorted(
            snapshot.docs.map((doc) => _map(doc.id, doc.data())),
          ),
        );
  }
}
