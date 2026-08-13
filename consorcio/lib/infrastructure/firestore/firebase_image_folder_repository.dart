import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/image_folder.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/image_folder_repository.dart';
import '../../domain/value_objects/geo_location.dart';

class FirebaseImageFolderRepository implements ImageFolderRepository {
  FirebaseImageFolderRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _folders =>
      _firestore.collection('folders');

  @override
  Future<ImageFolder?> getById(String id) async {
    final snapshot = await _folders.doc(id).get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    return _map(id, snapshot.data()!);
  }

  @override
  Future<List<ImageFolder>> listByOwner(String ownerId) async {
    final snapshot =
        await _folders.where('ownerId', isEqualTo: ownerId).get();
    final folders = snapshot.docs
        .map((doc) => _map(doc.id, doc.data()))
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return folders;
  }

  @override
  Future<ImageFolder> create(CreateImageFolderInput input) async {
    final now = Timestamp.now();
    final payload = <String, dynamic>{
      'name': input.name,
      'description': input.description,
      'ownerId': input.ownerId,
      'ownerName': input.ownerName,
      'imageCount': 0,
      'createdAt': now,
      'updatedAt': now,
    };

    final location = input.location;
    if (location != null && location.isValid) {
      payload['latitude'] = location.latitude;
      payload['longitude'] = location.longitude;
      if (location.accuracyMeters != null) {
        payload['locationAccuracy'] = location.accuracyMeters;
      }
      payload['locationCapturedAt'] = Timestamp.fromDate(
        location.capturedAt ?? DateTime.now(),
      );
    }

    final created = await _folders.add(payload);
    return _map(created.id, payload);
  }

  @override
  Future<ImageFolder> update({
    required String id,
    required String name,
    required String description,
  }) async {
    final ref = _folders.doc(id);
    final existing = await ref.get();
    if (!existing.exists) {
      throw DomainException('Carpeta no encontrada');
    }

    await ref.update({
      'name': name,
      'description': description,
      'updatedAt': Timestamp.now(),
    });

    final updated = await ref.get();
    return _map(id, updated.data()!);
  }

  @override
  Future<void> incrementImageCount(String folderId, int delta) async {
    await _folders.doc(folderId).update({
      'imageCount': FieldValue.increment(delta),
      'updatedAt': Timestamp.now(),
    });
  }

  ImageFolder _map(String id, Map<String, dynamic> data) {
    final captured = data['locationCapturedAt'];
    return ImageFolder(
      id: id,
      name: data['name'] as String? ?? '',
      description: data['description'] as String? ?? '',
      ownerId: data['ownerId'] as String? ?? '',
      ownerName: data['ownerName'] as String? ?? '',
      imageCount: (data['imageCount'] as num?)?.toInt() ?? 0,
      location: GeoLocation.tryParse({
        'latitude': data['latitude'],
        'longitude': data['longitude'],
        'locationAccuracy': data['locationAccuracy'],
        'locationCapturedAt':
            captured is Timestamp ? captured.toDate() : null,
      }),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
