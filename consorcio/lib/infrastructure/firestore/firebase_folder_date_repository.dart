import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/folder_date.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/folder_date_repository.dart';

class FirebaseFolderDateRepository implements FolderDateRepository {
  FirebaseFolderDateRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _dates =>
      _firestore.collection('folderDates');

  @override
  Future<FolderDate?> getById(String id) async {
    final snapshot = await _dates.doc(id).get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    return _map(snapshot.id, snapshot.data()!);
  }

  @override
  Future<List<FolderDate>> listByFolder(String folderId) async {
    final snapshot =
        await _dates.where('folderId', isEqualTo: folderId).get();
    final dates = snapshot.docs
        .map((doc) => _map(doc.id, doc.data()))
        .toList()
      ..sort((a, b) => b.dateKey.compareTo(a.dateKey));
    return dates;
  }

  @override
  Future<List<FolderDate>> listByFolderIds(List<String> folderIds) async {
    final unique = folderIds.where((id) => id.isNotEmpty).toSet().toList();
    if (unique.isEmpty) return [];
    final dates = <FolderDate>[];
    for (var index = 0; index < unique.length; index += 30) {
      final end = index + 30 > unique.length ? unique.length : index + 30;
      final chunk = unique.sublist(index, end);
      final snapshot =
          await _dates.where('folderId', whereIn: chunk).get();
      dates.addAll(snapshot.docs.map((doc) => _map(doc.id, doc.data())));
    }
    dates.sort((a, b) => b.dateKey.compareTo(a.dateKey));
    return dates;
  }

  @override
  Future<FolderDate?> findByFolderAndDateKey(
    String folderId,
    String dateKey,
  ) async {
    final snapshot = await _dates
        .where('folderId', isEqualTo: folderId)
        .where('dateKey', isEqualTo: dateKey)
        .limit(1)
        .get();
    if (snapshot.docs.isEmpty) return null;
    final doc = snapshot.docs.first;
    return _map(doc.id, doc.data());
  }

  @override
  Future<FolderDate> create(CreateFolderDateInput input) async {
    final now = Timestamp.now();
    final payload = <String, dynamic>{
      'folderId': input.folderId,
      'dateKey': input.dateKey,
      'note': input.note,
      'imageCount': 0,
      'createdById': input.createdById,
      'createdByName': input.createdByName,
      'createdAt': now,
      'updatedAt': now,
    };
    final created = await _dates.add(payload);
    return _map(created.id, payload);
  }

  @override
  Future<FolderDate> updateNote(String id, String note) async {
    final ref = _dates.doc(id);
    final snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data() == null) {
      throw DomainException('Fecha no encontrada');
    }
    final payload = {
      ...snapshot.data()!,
      'note': note,
      'updatedAt': Timestamp.now(),
    };
    await ref.update({
      'note': note,
      'updatedAt': Timestamp.now(),
    });
    return _map(id, payload);
  }

  @override
  Future<void> incrementImageCount(String dateId, int delta) async {
    final ref = _dates.doc(dateId);
    final existing = await ref.get();
    if (!existing.exists) {
      throw DomainException('Fecha no encontrada');
    }
    await ref.update({
      'imageCount': FieldValue.increment(delta),
      'updatedAt': Timestamp.now(),
    });
  }

  FolderDate _map(String id, Map<String, dynamic> data) {
    return FolderDate(
      id: id,
      folderId: data['folderId'] as String? ?? '',
      dateKey: data['dateKey'] as String? ?? '',
      note: data['note'] as String? ?? '',
      imageCount: (data['imageCount'] as num?)?.toInt() ?? 0,
      createdById: data['createdById'] as String? ?? '',
      createdByName: data['createdByName'] as String? ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
