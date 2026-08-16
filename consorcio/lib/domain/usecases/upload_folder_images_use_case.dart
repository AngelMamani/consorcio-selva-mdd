import '../entities/app_user.dart';
import '../entities/folder_image.dart';
import '../errors/domain_exception.dart';
import '../repositories/folder_image_repository.dart';
import '../repositories/image_folder_repository.dart';
import '../value_objects/geo_location.dart';

class UploadFolderImagesUseCase {
  UploadFolderImagesUseCase(this._folderRepository, this._imageRepository);

  final ImageFolderRepository _folderRepository;
  final FolderImageRepository _imageRepository;

  Future<List<FolderImage>> execute(
    AppUser actor, {
    required String folderId,
    required List<ImageFilePayload> files,
    GeoLocation? location,
    void Function(int current, int total)? onProgress,
  }) async {
    actor.assertCanOperateApp();

    final folder = await _folderRepository.getById(folderId);
    if (folder == null) {
      throw DomainException('Carpeta no encontrada');
    }
    if (!folder.canBeAccessedBy(actor.id)) {
      throw DomainException('No puedes subir a esta carpeta');
    }
    if (files.isEmpty) {
      throw DomainException('Selecciona al menos una imagen');
    }

    final uploaded = <FolderImage>[];
    for (var i = 0; i < files.length; i++) {
      onProgress?.call(i + 1, files.length);
      final file = files[i];
      if (file.sizeBytes <= 0 || file.sizeBytes > 10 * 1024 * 1024) {
        throw DomainException('Cada imagen debe pesar máximo 10 MB');
      }

      final image = await _imageRepository.create(
        folderId: folderId,
        file: file,
        uploadedById: actor.id,
        uploadedByName: actor.displayName,
        location: location,
      );
      await _folderRepository.incrementImageCount(folderId, 1);
      uploaded.add(image);
    }

    return uploaded;
  }
}
