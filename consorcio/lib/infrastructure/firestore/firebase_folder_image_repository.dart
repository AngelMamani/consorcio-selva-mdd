import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:uuid/uuid.dart';

import '../../domain/entities/folder_image.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../../domain/value_objects/geo_location.dart';

class FirebaseFolderImageRepository implements FolderImageRepository {
  FirebaseFolderImageRepository({
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _storage = storage ?? FirebaseStorage.instance;

  final FirebaseFirestore _firestore;
  final FirebaseStorage _storage;
  final _uuid = const Uuid();

  CollectionReference<Map<String, dynamic>> get _images =>
      _firestore.collection('folderImages');

  @override
  Future<List<FolderImage>> listByFolder(String folderId) async {
    final snapshot =
        await _images.where('folderId', isEqualTo: folderId).get();
    final images = snapshot.docs
        .map((doc) => _map(doc.id, doc.data()))
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return images;
  }

  @override
  Future<List<FolderImage>> listByFolderIds(List<String> folderIds) async {
    final unique = folderIds.where((id) => id.isNotEmpty).toSet().toList();
    if (unique.isEmpty) return [];
    final images = <FolderImage>[];
    for (var index = 0; index < unique.length; index += 30) {
      final end = index + 30 > unique.length ? unique.length : index + 30;
      final chunk = unique.sublist(index, end);
      final snapshot =
          await _images.where('folderId', whereIn: chunk).get();
      images.addAll(snapshot.docs.map((doc) => _map(doc.id, doc.data())));
    }
    images.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return images;
  }

  @override
  Future<List<FolderImage>> listByDate(String folderId, String dateId) async {
    final snapshot = await _images.where('dateId', isEqualTo: dateId).get();
    final images = snapshot.docs
        .map((doc) => _map(doc.id, doc.data()))
        .where((image) => image.folderId == folderId)
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return images;
  }

  @override
  Future<FolderImage> create({
    required String folderId,
    required String dateId,
    required ImageFilePayload file,
    required String uploadedById,
    required String uploadedByName,
    GeoLocation? location,
  }) async {
    final imageId = _uuid.v4();
    final safeName = file.fileName.replaceAll(RegExp(r'[^\w.\-() ]+'), '_');
    final storagePath = 'folders/$folderId/$dateId/${imageId}_$safeName';
    final storageRef = _storage.ref(storagePath);

    await storageRef.putData(
      file.bytes,
      SettableMetadata(contentType: file.contentType),
    );

    final downloadUrl = await storageRef.getDownloadURL();
    final now = Timestamp.now();
    final payload = <String, dynamic>{
      'folderId': folderId,
      'dateId': dateId,
      'fileName': file.fileName,
      'storagePath': storagePath,
      'downloadUrl': downloadUrl,
      'contentType': file.contentType,
      'sizeBytes': file.sizeBytes,
      'uploadedById': uploadedById,
      'uploadedByName': uploadedByName,
      'createdAt': now,
    };

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

    final created = await _images.add(payload);
    return _map(created.id, payload);
  }

  FolderImage _map(String id, Map<String, dynamic> data) {
    final captured = data['locationCapturedAt'];
    return FolderImage(
      id: id,
      folderId: data['folderId'] as String? ?? '',
      dateId: data['dateId'] as String? ?? '',
      fileName: data['fileName'] as String? ?? '',
      storagePath: data['storagePath'] as String? ?? '',
      downloadUrl: data['downloadUrl'] as String? ?? '',
      contentType: data['contentType'] as String? ?? '',
      sizeBytes: (data['sizeBytes'] as num?)?.toInt() ?? 0,
      uploadedById: data['uploadedById'] as String? ?? '',
      uploadedByName: data['uploadedByName'] as String? ?? '',
      location: GeoLocation.tryParse({
        'latitude': data['latitude'],
        'longitude': data['longitude'],
        'locationAccuracy': data['locationAccuracy'],
        'locationCapturedAt':
            captured is Timestamp ? captured.toDate() : null,
      }),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
