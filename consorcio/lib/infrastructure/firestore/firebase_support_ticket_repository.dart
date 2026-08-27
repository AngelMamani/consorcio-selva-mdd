import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/support_ticket.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/support_ticket_repository.dart';

class FirebaseSupportTicketRepository implements SupportTicketRepository {
  FirebaseSupportTicketRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _tickets =>
      _firestore.collection('supportTickets');

  SupportTicket _map(String id, Map<String, dynamic> data) {
    return SupportTicket(
      id: id,
      kind: (data['kind'] as String?) ?? 'SUGERENCIA',
      message: (data['message'] as String?) ?? '',
      status: (data['status'] as String?) ?? 'ABIERTO',
      createdById: (data['createdById'] as String?) ?? '',
      createdByName: (data['createdByName'] as String?) ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      response: (data['response'] as String?) ?? '',
      resolvedAt: (data['resolvedAt'] as Timestamp?)?.toDate(),
      resolvedById: (data['resolvedById'] as String?) ?? '',
      resolvedByName: (data['resolvedByName'] as String?) ?? '',
    );
  }

  @override
  Future<SupportTicket> create({
    required String kind,
    required String message,
    required String createdById,
    required String createdByName,
  }) async {
    final payload = {
      'kind': kind,
      'message': message,
      'status': 'ABIERTO',
      'createdById': createdById,
      'createdByName': createdByName,
      'createdAt': FieldValue.serverTimestamp(),
      'response': '',
      'resolvedById': '',
      'resolvedByName': '',
    };
    final doc = await _tickets.add(payload);
    final snapshot = await doc.get();
    return _map(doc.id, snapshot.data() ?? payload);
  }

  @override
  Future<List<SupportTicket>> listMine(String userId) async {
    final snapshot = await _tickets
        .where('createdById', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .limit(80)
        .get();
    return snapshot.docs.map((doc) => _map(doc.id, doc.data())).toList();
  }

  @override
  Future<List<SupportTicket>> listAll() async {
    final snapshot =
        await _tickets.orderBy('createdAt', descending: true).limit(200).get();
    return snapshot.docs.map((doc) => _map(doc.id, doc.data())).toList();
  }

  @override
  Future<SupportTicket> resolve({
    required String ticketId,
    required String response,
    required String resolvedById,
    required String resolvedByName,
  }) async {
    final ref = _tickets.doc(ticketId);
    final existing = await ref.get();
    if (!existing.exists) {
      throw DomainException('El aviso no existe');
    }
    await ref.update({
      'status': 'RESUELTO',
      'response': response,
      'resolvedAt': FieldValue.serverTimestamp(),
      'resolvedById': resolvedById,
      'resolvedByName': resolvedByName,
    });
    final updated = await ref.get();
    return _map(ticketId, updated.data()!);
  }
}
