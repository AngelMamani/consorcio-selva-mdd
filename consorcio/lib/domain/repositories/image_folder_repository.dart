import '../entities/image_folder.dart';
import '../value_objects/geo_location.dart';

class CreateImageFolderInput {
  const CreateImageFolderInput({
    required this.areaId,
    required this.areaName,
    required this.name,
    required this.description,
    required this.ownerId,
    required this.ownerName,
    required this.assignToAllTechnicians,
    required this.assignedTechnicianIds,
    required this.assignedTechnicianNames,
    this.location,
  });

  final String areaId;
  final String areaName;
  final String name;
  final String description;
  final String ownerId;
  final String ownerName;
  final bool assignToAllTechnicians;
  final List<String> assignedTechnicianIds;
  final List<String> assignedTechnicianNames;
  final GeoLocation? location;
}

abstract class ImageFolderRepository {
  Future<ImageFolder?> getById(String id);
  Future<List<ImageFolder>> listByOwner(String ownerId);
  Future<List<ImageFolder>> listAccessibleForUser(String userId);
  Future<List<ImageFolder>> listByOwnerAndArea({
    required String ownerId,
    required String areaId,
  });
  Future<List<ImageFolder>> listAccessibleForUserAndArea({
    required String userId,
    required String areaId,
  });
  Future<ImageFolder> create(CreateImageFolderInput input);
  Future<ImageFolder> update({
    required String id,
    required String name,
    required String description,
    required bool assignToAllTechnicians,
    required List<String> assignedTechnicianIds,
    required List<String> assignedTechnicianNames,
  });
  Future<void> incrementImageCount(String folderId, int delta);
}
