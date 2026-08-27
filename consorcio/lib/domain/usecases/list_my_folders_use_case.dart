import '../entities/app_user.dart';
import '../entities/image_folder.dart';
import '../repositories/folder_image_repository.dart';
import '../repositories/image_folder_repository.dart';

class ListMyFoldersUseCase {
  ListMyFoldersUseCase(this._folderRepository, this._imageRepository);

  final ImageFolderRepository _folderRepository;
  final FolderImageRepository _imageRepository;

  Future<List<ImageFolder>> execute(
    AppUser actor, {
    String? areaId,
  }) async {
    actor.assertCanOperateApp();
    final trimmed = areaId?.trim();
    final folders = trimmed != null && trimmed.isNotEmpty
        ? await _folderRepository.listAccessibleForUserAndArea(
            userId: actor.id,
            areaId: trimmed,
          )
        : await _folderRepository.listAccessibleForUser(actor.id);

    if (actor.isMobileAdmin || folders.isEmpty) return folders;

    final images = await _imageRepository.listByFolderIds(
      folders.map((folder) => folder.id).toList(),
    );
    final mineByFolder = <String, int>{};
    for (final image in images) {
      if (image.uploadedById != actor.id) continue;
      mineByFolder[image.folderId] = (mineByFolder[image.folderId] ?? 0) + 1;
    }
    return [
      for (final folder in folders)
        folder.copyWith(imageCount: mineByFolder[folder.id] ?? 0),
    ];
  }
}
