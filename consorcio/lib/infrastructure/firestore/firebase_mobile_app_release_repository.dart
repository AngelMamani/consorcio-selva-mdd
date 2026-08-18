import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/mobile_app_release.dart';
import '../../domain/repositories/mobile_app_release_repository.dart';

class FirebaseMobileAppReleaseRepository implements MobileAppReleaseRepository {
  FirebaseMobileAppReleaseRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  @override
  Future<MobileAppRelease?> getRelease() async {
    final snapshot =
        await _firestore.collection('settings').doc('mobileApp').get();
    if (!snapshot.exists || snapshot.data() == null) return null;
    final data = snapshot.data()!;
    final versionCode = (data['versionCode'] as num?)?.toInt() ?? 0;
    final apkUrl = data['apkUrl'] as String? ?? '';
    if (versionCode <= 0 || apkUrl.isEmpty) return null;
    return MobileAppRelease(
      versionName: data['versionName'] as String? ?? '',
      versionCode: versionCode,
      apkUrl: apkUrl,
      notes: data['notes'] as String? ?? '',
      forceUpdate: data['forceUpdate'] == true,
    );
  }
}
