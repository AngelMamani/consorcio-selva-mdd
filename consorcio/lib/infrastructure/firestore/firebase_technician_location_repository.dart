import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/repositories/technician_location_repository.dart';

class FirebaseTechnicianLocationRepository
    implements TechnicianLocationRepository {
  FirebaseTechnicianLocationRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _locations =>
      _firestore.collection('technicianLocations');

  @override
  Future<void> publishLive({
    required String userId,
    required String displayName,
    required double latitude,
    required double longitude,
    required double? accuracyMeters,
    bool recordTrail = false,
  }) {
    final parent = _locations.doc(userId);
    final snapshot = {
      'userId': userId,
      'displayName': displayName,
      'latitude': latitude,
      'longitude': longitude,
      'accuracyMeters': accuracyMeters,
      'gpsActive': true,
      'updatedAt': FieldValue.serverTimestamp(),
    };
    if (!recordTrail) {
      return parent.set(snapshot, SetOptions(merge: true));
    }
    final batch = _firestore.batch();
    batch.set(parent, snapshot, SetOptions(merge: true));
    batch.set(parent.collection('routePoints').doc(), {
      'userId': userId,
      'latitude': latitude,
      'longitude': longitude,
      'accuracyMeters': accuracyMeters,
      'capturedAt': FieldValue.serverTimestamp(),
    });
    return batch.commit();
  }

  @override
  Future<void> markGpsOff({
    required String userId,
    required String displayName,
  }) {
    return _locations.doc(userId).set(
      {
        'userId': userId,
        'displayName': displayName,
        'gpsActive': false,
        'updatedAt': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  }
}
