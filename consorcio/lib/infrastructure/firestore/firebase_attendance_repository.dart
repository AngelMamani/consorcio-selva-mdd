import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';

import '../../domain/entities/attendance.dart';
import '../../domain/entities/attendance_settings.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/attendance_repository.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../../domain/value_objects/geo_location.dart';

class FirebaseAttendanceRepository implements AttendanceRepository {
  FirebaseAttendanceRepository({
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _storage = storage ?? FirebaseStorage.instance;

  final FirebaseFirestore _firestore;
  final FirebaseStorage _storage;

  CollectionReference<Map<String, dynamic>> get _attendances =>
      _firestore.collection('attendances');

  DocumentReference<Map<String, dynamic>> get _settings =>
      _firestore.collection('settings').doc('attendance');

  @override
  Future<AttendanceSettings> getSettings() async {
    final snapshot = await _settings.get();
    if (!snapshot.exists || snapshot.data() == null) {
      return AttendanceSettings.defaults;
    }
    final data = snapshot.data()!;
    return AttendanceSettings(
      officeName: data['officeName'] as String? ?? AttendanceSettings.defaults.officeName,
      officeLatitude: (data['officeLatitude'] as num?)?.toDouble() ??
          AttendanceSettings.defaults.officeLatitude,
      officeLongitude: (data['officeLongitude'] as num?)?.toDouble() ??
          AttendanceSettings.defaults.officeLongitude,
      officeRadiusMeters: AttendanceSettings.normalizeRadius(
        (data['officeRadiusMeters'] as num?)?.toInt() ??
            AttendanceSettings.defaults.officeRadiusMeters,
      ),
    );
  }

  @override
  Future<Attendance?> getByUserAndDate(String userId, String dateKey) async {
    final snapshot =
        await _attendances.doc(attendanceDocId(userId, dateKey)).get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    return _map(snapshot.id, snapshot.data()!);
  }

  @override
  Future<Attendance> create({
    required String userId,
    required String userName,
    required String dateKey,
    required AttendanceOrigin origin,
    required String areaId,
    required String areaName,
    required GeoLocation location,
    required bool officeValidated,
    int? distanceToOfficeMeters,
    String? officeQrToken,
    required ImageFilePayload environmentPhoto,
  }) async {
    final id = attendanceDocId(userId, dateKey);
    final ref = _attendances.doc(id);
    final existing = await ref.get();
    if (existing.exists) {
      throw DomainException('Ya marcaste asistencia hoy');
    }

    final storagePath = 'attendances/$userId/$dateKey/entorno.jpg';
    final storageRef = _storage.ref(storagePath);
    late final String photoUrl;
    try {
      await storageRef.putData(
        environmentPhoto.bytes,
        SettableMetadata(
          contentType: environmentPhoto.contentType.isEmpty
              ? 'image/jpeg'
              : environmentPhoto.contentType,
        ),
      );
      photoUrl = await storageRef.getDownloadURL();
    } catch (_) {
      throw DomainException(
        'No se pudo subir la foto del entorno. Revisa tu conexión.',
      );
    }

    final now = Timestamp.now();
    final payload = <String, dynamic>{
      'userId': userId,
      'userName': userName,
      'dateKey': dateKey,
      'origin': origin.firestoreValue,
      'areaId': areaId,
      'areaName': areaName,
      'latitude': location.latitude,
      'longitude': location.longitude,
      'officeValidated': officeValidated,
      'environmentPhotoUrl': photoUrl,
      'environmentPhotoPath': storagePath,
      'createdAt': now,
    };
    if (location.accuracyMeters != null) {
      payload['locationAccuracy'] = location.accuracyMeters;
    }
    if (distanceToOfficeMeters != null) {
      payload['distanceToOfficeMeters'] = distanceToOfficeMeters;
    }
    if (officeQrToken != null && officeQrToken.isNotEmpty) {
      payload['officeQrToken'] = officeQrToken;
    }
    try {
      await ref.set(payload);
    } on FirebaseException catch (error) {
      if (error.code == 'permission-denied') {
        throw DomainException(
          'QR inválido, vencido o no es de hoy. Pide el código actualizado en oficina.',
        );
      }
      throw DomainException('No se pudo marcar la asistencia');
    }
    return _map(id, payload);
  }

  Attendance _map(String id, Map<String, dynamic> data) {
    return Attendance(
      id: id,
      userId: data['userId'] as String? ?? '',
      userName: data['userName'] as String? ?? '',
      dateKey: data['dateKey'] as String? ?? '',
      origin: AttendanceOrigin.fromString(data['origin'] as String? ?? 'OFICINA'),
      areaId: data['areaId'] as String? ?? '',
      areaName: data['areaName'] as String? ?? '',
      location: GeoLocation(
        latitude: (data['latitude'] as num?)?.toDouble() ?? 0,
        longitude: (data['longitude'] as num?)?.toDouble() ?? 0,
        accuracyMeters: (data['locationAccuracy'] as num?)?.toDouble(),
        capturedAt: (data['createdAt'] as Timestamp?)?.toDate(),
      ),
      officeValidated: data['officeValidated'] == true,
      distanceToOfficeMeters: (data['distanceToOfficeMeters'] as num?)?.toInt(),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      environmentPhotoUrl: data['environmentPhotoUrl'] as String?,
    );
  }
}
