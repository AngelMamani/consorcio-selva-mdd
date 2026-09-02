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
    final rawPoints = data['officePoints'];
    final officePoints = rawPoints is List
        ? rawPoints
            .whereType<Map<String, dynamic>>()
            .map(
              (point) => AttendanceOfficePoint(
                id: point['id'] as String? ?? 'legacy',
                name: point['name'] as String? ??
                    AttendanceSettings.defaults.officeName,
                latitude: (point['latitude'] as num?)?.toDouble() ??
                    AttendanceSettings.defaults.officeLatitude,
                longitude: (point['longitude'] as num?)?.toDouble() ??
                    AttendanceSettings.defaults.officeLongitude,
                radiusMeters: AttendanceSettings.normalizeRadius(
                  (point['radiusMeters'] as num?)?.toInt() ??
                      AttendanceSettings.defaults.officeRadiusMeters,
                ),
              ),
            )
            .toList()
        : <AttendanceOfficePoint>[];

    final officeName =
        data['officeName'] as String? ?? AttendanceSettings.defaults.officeName;
    final officeLatitude = (data['officeLatitude'] as num?)?.toDouble() ??
        AttendanceSettings.defaults.officeLatitude;
    final officeLongitude = (data['officeLongitude'] as num?)?.toDouble() ??
        AttendanceSettings.defaults.officeLongitude;
    final officeRadiusMeters = AttendanceSettings.normalizeRadius(
      (data['officeRadiusMeters'] as num?)?.toInt() ??
          AttendanceSettings.defaults.officeRadiusMeters,
    );

    return AttendanceSettings(
      officePoints: officePoints.isNotEmpty
          ? officePoints
          : [
              AttendanceOfficePoint(
                id: 'legacy',
                name: officeName,
                latitude: officeLatitude,
                longitude: officeLongitude,
                radiusMeters: officeRadiusMeters,
              ),
            ],
      officeName: officeName,
      officeLatitude: officeLatitude,
      officeLongitude: officeLongitude,
      officeRadiusMeters: officeRadiusMeters,
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
    String permissionNote = '',
    ImageFilePayload? environmentPhoto,
  }) async {
    final id = attendanceDocId(userId, dateKey);
    final ref = _attendances.doc(id);
    final existing = await ref.get();
    if (existing.exists) {
      throw DomainException('Ya marcaste asistencia hoy');
    }

    String? photoUrl;
    String? storagePath;
    if (environmentPhoto != null) {
      storagePath = 'attendances/$userId/$dateKey/entorno.jpg';
      final storageRef = _storage.ref(storagePath);
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
          'No se pudo subir la foto. Revisa tu conexión.',
        );
      }
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
      'createdAt': now,
    };
    if (photoUrl != null && storagePath != null) {
      payload['environmentPhotoUrl'] = photoUrl;
      payload['environmentPhotoPath'] = storagePath;
    }
    if (location.accuracyMeters != null) {
      payload['locationAccuracy'] = location.accuracyMeters;
    }
    if (distanceToOfficeMeters != null) {
      payload['distanceToOfficeMeters'] = distanceToOfficeMeters;
    }
    final trimmedNote = permissionNote.trim();
    if (trimmedNote.isNotEmpty) {
      payload['permissionNote'] =
          trimmedNote.length > 200 ? trimmedNote.substring(0, 200) : trimmedNote;
    }
    try {
      await ref.set(payload);
    } on FirebaseException catch (error) {
      if (error.code == 'permission-denied') {
        throw DomainException(
          'No se pudo registrar. Revisa el GPS, el radio de oficina o si ya hay una marca hoy.',
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
      permissionNote: data['permissionNote'] as String?,
    );
  }
}
