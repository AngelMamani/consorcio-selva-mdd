import '../entities/image_folder.dart';
import '../value_objects/geo_location.dart';

class CreateImageFolderInput {
  const CreateImageFolderInput({
    required this.name,
    required this.description,
    required this.ownerId,
    required this.ownerName,
    this.location,
  });

  final String name;
  final String description;
  final String ownerId;
  final String ownerName;
  final GeoLocation? location;
}

abstract class ImageFolderRepository {
  Future<ImageFolder?> getById(String id);
  Future<List<ImageFolder>> listByOwner(String ownerId);
  Future<ImageFolder> create(CreateImageFolderInput input);
  Future<ImageFolder> update({
    required String id,
    required String name,
    required String description,
  });
  Future<void> incrementImageCount(String folderId, int delta);
}
