import '../entities/image_folder.dart';
import '../entities/supply.dart';
import '../value_objects/geo_location.dart';

const virtualSupplyFolderPrefix = 'virtual:';

String supplyFolderDocId(String areaId, String routeCode) {
  return 'sf_${areaId}_$routeCode';
}

final _supplyFolderIdRe = RegExp(
  r'^sf_([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})_(\d{7,12})$',
);

({String areaId, String routeCode})? parseSupplyFolderDocId(String id) {
  final match = _supplyFolderIdRe.firstMatch(id);
  if (match == null) return null;
  return (areaId: match.group(1)!, routeCode: match.group(2)!);
}

String virtualSupplyFolderId(String routeCode) {
  return '$virtualSupplyFolderPrefix$routeCode';
}

bool isVirtualSupplyFolderId(String id) {
  return id.startsWith(virtualSupplyFolderPrefix);
}

ImageFolder folderFromSupply({
  required String areaId,
  required String areaName,
  required Supply supply,
  ImageFolder? existing,
}) {
  if (existing != null) return existing;
  final now = DateTime.now();
  return ImageFolder(
    id: supplyFolderDocId(areaId, supply.routeCode),
    areaId: areaId,
    areaName: areaName,
    name: supply.routeCode,
    description: 'Suministro',
    ownerId: '',
    ownerName: '',
    assignToAllTechnicians: true,
    assignedTechnicianIds: const [],
    assignedTechnicianNames: const [],
    imageCount: 0,
    createdAt: now,
    updatedAt: now,
    routeCode: supply.routeCode,
    location: GeoLocation(
      latitude: supply.latitude,
      longitude: supply.longitude,
    ),
  );
}
