import '../entities/app_user.dart';
import '../entities/image_folder.dart';
import '../repositories/image_folder_repository.dart';

class ListMyFoldersUseCase {
  ListMyFoldersUseCase(this._folderRepository);
  final ImageFolderRepository _folderRepository;

  Future<List<ImageFolder>> execute(
    AppUser actor, {
    String? areaId,
  }) async {
    actor.assertCanOperateApp();
    final trimmed = areaId?.trim();
    if (trimmed != null && trimmed.isNotEmpty) {
      return _folderRepository.listAccessibleForUserAndArea(
        userId: actor.id,
        areaId: trimmed,
      );
    }
    return _folderRepository.listAccessibleForUser(actor.id);
  }
}
