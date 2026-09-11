import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';

import '../../domain/entities/attendance_permission_request.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/attendance_permission_request_repository.dart';
import '../../domain/repositories/folder_image_repository.dart';
import 'firestore_client.dart';

class FirebaseAttendancePermissionRequestRepository
    implements AttendancePermissionRequestRepository {
  FirebaseAttendancePermissionRequestRepository({
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _storage = storage ?? FirebaseStorage.instance;

  final FirebaseFirestore _firestore;
  final FirebaseStorage _storage;

  CollectionReference<Map<String, dynamic>> get _requests =>
      _firestore.collection('attendancePermissionRequests');

  AttendancePermissionRequest _map(String id, Map<String, dynamic> data) {
    return AttendancePermissionRequest(
      id: id,
      userId: data['userId'] as String? ?? '',
      userName: data['userName'] as String? ?? '',
      description: data['description'] as String? ?? '',
      status: data['status'] as String? ??
          AttendancePermissionRequestStatus.pending,
      evidencePhotoUrl: data['evidencePhotoUrl'] as String?,
      leaveDays: (data['leaveDays'] as num?)?.toInt(),
      startDateKey: data['startDateKey'] as String?,
      endDateKey: data['endDateKey'] as String?,
      adminNote: data['adminNote'] as String?,
      createdAt:
          (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  @override
  Future<AttendancePermissionRequest> create({
    required String userId,
    required String userName,
    required String description,
    ImageFilePayload? evidencePhoto,
  }) async {
    String? photoUrl;
    String? storagePath;
    if (evidencePhoto != null) {
      final fileId = DateTime.now().millisecondsSinceEpoch.toString();
      storagePath = 'attendances/$userId/permission-requests/$fileId.jpg';
      try {
        final ref = _storage.ref(storagePath);
        await ref
            .putData(
              evidencePhoto.bytes,
              SettableMetadata(
                contentType: evidencePhoto.contentType.isEmpty
                    ? 'image/jpeg'
                    : evidencePhoto.contentType,
              ),
            )
            .timeout(const Duration(seconds: 20));
        photoUrl = await ref.getDownloadURL().timeout(
          const Duration(seconds: 10),
        );
      } on DomainException {
        rethrow;
      } catch (_) {
        throw DomainException(
          'No se pudo subir la foto. Revisa tu conexión.',
        );
      }
    }

    final payload = <String, dynamic>{
      'userId': userId,
      'userName': userName.trim().isEmpty ? 'Usuario' : userName.trim(),
      'description': description,
      'status': AttendancePermissionRequestStatus.pending,
      'createdAt': Timestamp.now(),
    };
    if (photoUrl != null && storagePath != null) {
      payload['evidencePhotoUrl'] = photoUrl;
      payload['evidencePhotoPath'] = storagePath;
    }

    try {
      final ref = _requests.doc();
      await setQueued(ref, payload, timeout: const Duration(seconds: 8));
      return _map(ref.id, {
        ...payload,
        'createdAt': payload['createdAt'],
      });
    } on FirebaseException catch (error) {
      if (error.code == 'permission-denied') {
        throw DomainException(
          'No se pudo enviar la solicitud (permiso denegado). '
          'Cierra sesión, vuelve a entrar e intenta de nuevo.',
        );
      }
      if (error.code == 'unavailable' || error.code == 'network-request-failed') {
        throw DomainException(
          'Sin conexión. Revisa tu internet e intenta de nuevo.',
        );
      }
      throw DomainException(
        'No se pudo enviar la solicitud de permiso (${error.code}).',
      );
    }
  }

  @override
  Future<List<AttendancePermissionRequest>> listByUser(String userId) async {
    try {
      final snapshot = await queryFast(
        _requests
            .where('userId', isEqualTo: userId)
            .orderBy('createdAt', descending: true)
            .limit(20),
        timeout: const Duration(seconds: 8),
      );
      return snapshot.docs.map((doc) => _map(doc.id, doc.data())).toList();
    } catch (_) {
      return const [];
    }
  }

  @override
  Future<List<AttendancePermissionRequest>> listPendingByUser(
    String userId,
  ) async {
    try {
      final snapshot = await _requests
          .where('userId', isEqualTo: userId)
          .where(
            'status',
            isEqualTo: AttendancePermissionRequestStatus.pending,
          )
          .limit(1)
          .get()
          .timeout(const Duration(seconds: 6));
      return snapshot.docs.map((doc) => _map(doc.id, doc.data())).toList();
    } on FirebaseException catch (error) {
      if (error.code == 'failed-precondition' ||
          error.code == 'permission-denied') {
        return const [];
      }
      rethrow;
    } on TimeoutException {
      return const [];
    }
  }
}
