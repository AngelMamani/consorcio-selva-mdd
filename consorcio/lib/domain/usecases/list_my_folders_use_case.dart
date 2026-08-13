import '../entities/app_user.dart';
import '../entities/image_folder.dart';
import '../repositories/image_folder_repository.dart';

class ListMyFoldersUseCase {
  ListMyFoldersUseCase(this._folderRepository);
  final ImageFolderRepository _folderRepository;

  Future<List<ImageFolder>> execute(AppUser actor) async {
    actor.assertCanOperateApp();
    return _folderRepository.listByOwner(actor.id);
  }
}
