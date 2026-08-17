import '../value_objects/geo_location.dart';

class FolderImage {
  const FolderImage({
    required this.id,
    required this.folderId,
    required this.dateId,
    required this.fileName,
    required this.storagePath,
    required this.downloadUrl,
    required this.contentType,
    required this.sizeBytes,
    required this.uploadedById,
    required this.uploadedByName,
    required this.createdAt,
    this.location,
  });

  final String id;
  final String folderId;
  final String dateId;
  final String fileName;
  final String storagePath;
  final String downloadUrl;
  final String contentType;
  final int sizeBytes;
  final String uploadedById;
  final String uploadedByName;
  final GeoLocation? location;
  final DateTime createdAt;

  bool get hasLocation => location != null && location!.isValid;
}
