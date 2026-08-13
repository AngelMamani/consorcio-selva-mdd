import '../entities/app_user.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/image_folder_repository.dart';

class UpdateFolderUseCase {
  UpdateFolderUseCase(this._folderRepository);
  final ImageFolderRepository _folderRepository;

  Future<ImageFolder> execute(
    AppUser actor, {
    required String folderId,
    required String name,
    required String description,
  }) async {
    actor.assertCanOperateApp();

    final folder = await _folderRepository.getById(folderId);
    if (folder == null) {
      throw DomainException('Carpeta no encontrada');
    }
    if (folder.ownerId != actor.id) {
      throw DomainException('No puedes editar esta carpeta');
    }

    final cleanName = name.trim();
    if (cleanName.isEmpty) {
      throw DomainException('El nombre de la carpeta es obligatorio');
    }

    return _folderRepository.update(
      id: folderId,
      name: cleanName,
      description: description.trim(),
    );
  }
}
