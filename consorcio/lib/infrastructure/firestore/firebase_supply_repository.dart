import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/supply.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/supply_repository.dart';
import '../../domain/services/geo_distance_service.dart';

class FirebaseSupplyRepository implements SupplyRepository {
  FirebaseSupplyRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _supplies =>
      _firestore.collection('supplies');

  @override
  Future<Supply?> getByRouteCode(String routeCode) async {
    final snapshot = await _supplies.doc(routeCode).get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    return _map(snapshot.id, snapshot.data()!);
  }

  @override
  Future<List<Supply>> searchByPrefix(String prefix, {int limit = 20}) async {
    final snapshot = await _supplies
        .where('routeCode', isGreaterThanOrEqualTo: prefix)
        .where('routeCode', isLessThanOrEqualTo: '$prefix\uf8ff')
        .orderBy('routeCode')
        .limit(limit)
        .get();
    return snapshot.docs.map((doc) => _map(doc.id, doc.data())).toList();
  }

  @override
  Future<List<Supply>> listNear({
    required double latitude,
    required double longitude,
    required double radiusMeters,
    int limit = 250,
  }) async {
    final box = boundingBox(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
    );
    final fetchLimit = limit * 3 < 80 ? 80 : (limit * 3 > 800 ? 800 : limit * 3);

    List<Supply> docs;
    try {
      final snapshot = await _supplies
          .where('latitude', isGreaterThanOrEqualTo: box.minLat)
          .where('latitude', isLessThanOrEqualTo: box.maxLat)
          .where('longitude', isGreaterThanOrEqualTo: box.minLng)
          .where('longitude', isLessThanOrEqualTo: box.maxLng)
          .limit(fetchLimit)
          .get();
      docs = snapshot.docs.map((doc) => _map(doc.id, doc.data())).toList();
    } on FirebaseException catch (error) {
      if (error.code != 'failed-precondition') rethrow;
      final snapshot = await _supplies
          .where('latitude', isGreaterThanOrEqualTo: box.minLat)
          .where('latitude', isLessThanOrEqualTo: box.maxLat)
          .orderBy('latitude')
          .limit(fetchLimit)
          .get();
      docs = snapshot.docs.map((doc) => _map(doc.id, doc.data())).toList();
    }

    return docs
        .where((supply) => supply.hasLocation)
        .where(
          (supply) =>
              supply.longitude! >= box.minLng &&
              supply.longitude! <= box.maxLng &&
              distanceMeters(
                    latitudeA: latitude,
                    longitudeA: longitude,
                    latitudeB: supply.latitude!,
                    longitudeB: supply.longitude!,
                  ) <=
                  radiusMeters,
        )
        .take(limit)
        .toList();
  }

  @override
  Future<Supply> ensureManual({
    required String routeCode,
    String note = '',
  }) async {
    final existing = await getByRouteCode(routeCode);
    if (existing != null) return existing;
    final payload = <String, dynamic>{
      'routeCode': routeCode,
      'prefix': routeCode.substring(0, 4),
      'updatedAt': Timestamp.now(),
    };
    final cleanNote = note.trim();
    if (cleanNote.isNotEmpty) payload['note'] = cleanNote;
    await _supplies.doc(routeCode).set(payload);
    return _map(routeCode, payload);
  }

  @override
  Future<Supply> setLocation({
    required String routeCode,
    required double latitude,
    required double longitude,
  }) async {
    final existing = await getByRouteCode(routeCode);
    if (existing == null) {
      throw DomainException('No hay suministro con ese código');
    }
    if (existing.hasLocation) return existing;
    await _supplies.doc(routeCode).update({
      'latitude': latitude,
      'longitude': longitude,
      'updatedAt': Timestamp.now(),
    });
    return Supply(
      id: existing.id,
      routeCode: existing.routeCode,
      latitude: latitude,
      longitude: longitude,
      prefix: existing.prefix,
      note: existing.note,
    );
  }

  CollectionReference<Map<String, dynamic>> get _seds =>
      _firestore.collection('seds');

  @override
  Future<Sed?> getSedByCode(String code) async {
    final snapshot = await _seds.doc(code).get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    return _mapSed(snapshot.id, snapshot.data()!);
  }

  @override
  Future<List<Sed>> searchSedsByPrefix(String prefix, {int limit = 12}) async {
    final snapshot = await _seds
        .where('code', isGreaterThanOrEqualTo: prefix)
        .where('code', isLessThanOrEqualTo: '$prefix\uf8ff')
        .orderBy('code')
        .limit(limit)
        .get();
    return snapshot.docs.map((doc) => _mapSed(doc.id, doc.data())).toList();
  }

  @override
  Future<SupplyCatalogStatus?> getCatalogStatus() async {
    final snapshot =
        await _firestore.collection('settings').doc('suppliesCatalog').get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    final data = snapshot.data()!;
    return SupplyCatalogStatus(
      supplyCount: (data['count'] as num?)?.toInt() ?? 0,
      sedCount: (data['sedCount'] as num?)?.toInt() ?? 0,
    );
  }

  Supply _map(String id, Map<String, dynamic> data) {
    final latitude = (data['latitude'] as num?)?.toDouble();
    final longitude = (data['longitude'] as num?)?.toDouble();
    final hasPoint = latitude != null &&
        longitude != null &&
        latitude.isFinite &&
        longitude.isFinite &&
        !(latitude == 0 && longitude == 0);
    return Supply(
      id: id,
      routeCode: data['routeCode'] as String? ?? id,
      latitude: hasPoint ? latitude : null,
      longitude: hasPoint ? longitude : null,
      prefix: data['prefix'] as String? ?? '',
      note: data['note'] as String? ?? '',
    );
  }

  Sed _mapSed(String id, Map<String, dynamic> data) {
    return Sed(
      id: id,
      code: data['code'] as String? ?? id,
      name: data['name'] as String? ?? '',
      latitude: (data['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (data['longitude'] as num?)?.toDouble() ?? 0,
    );
  }
}
