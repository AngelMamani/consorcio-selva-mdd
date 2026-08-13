import '../entities/app_user.dart';
import '../entities/folder_image.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/folder_image_repository.dart';
import '../repositories/image_folder_repository.dart';

class GetFolderDetailUseCase {
  GetFolderDetailUseCase(this._folderRepository, this._imageRepository);

  final ImageFolderRepository _folderRepository;
  final FolderImageRepository _imageRepository;

  Future<({ImageFolder folder, List<FolderImage> images})> execute(
    AppUser actor,
    String folderId,
  ) async {
    actor.assertCanOperateApp();

    final folder = await _folderRepository.getById(folderId);
    if (folder == null) {
      throw DomainException('Carpeta no encontrada');
    }
    if (folder.ownerId != actor.id) {
      throw DomainException('No tienes acceso a esta carpeta');
    }

    final images = await _imageRepository.listByFolder(folderId);
    return (folder: folder, images: images);
  }
}
