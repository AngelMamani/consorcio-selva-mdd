import 'dart:typed_data';

import '../entities/folder_image.dart';
import '../value_objects/geo_location.dart';

class ImageFilePayload {
  const ImageFilePayload({
    required this.fileName,
    required this.contentType,
    required this.bytes,
  });

  final String fileName;
  final String contentType;
  final Uint8List bytes;

  int get sizeBytes => bytes.length;
}

abstract class FolderImageRepository {
  Future<List<FolderImage>> listByFolder(String folderId);
  Future<List<FolderImage>> listByFolderIds(List<String> folderIds);
  Future<List<FolderImage>> listByDate(String folderId, String dateId);
  Future<FolderImage> create({
    required String folderId,
    required String dateId,
    required ImageFilePayload file,
    required String uploadedById,
    required String uploadedByName,
    GeoLocation? location,
  });
}
