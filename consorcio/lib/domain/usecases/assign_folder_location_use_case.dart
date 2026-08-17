import '../entities/app_user.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/image_folder_repository.dart';
import '../value_objects/geo_location.dart';

class AssignFolderLocationUseCase {
  AssignFolderLocationUseCase(this._folderRepository);
  final ImageFolderRepository _folderRepository;

  Future<ImageFolder> execute(
    AppUser actor, {
    required String folderId,
    required GeoLocation location,
  }) async {
    actor.assertCanOperateApp();

    if (!location.isValid) {
      throw DomainException('La ubicación GPS no es válida');
    }

    final folder = await _folderRepository.getById(folderId);
    if (folder == null) {
      throw DomainException('Carpeta no encontrada');
    }
    if (!folder.canBeAccessedBy(actor.id)) {
      throw DomainException('No tienes acceso a esta carpeta');
    }

    return _folderRepository.assignLocation(
      id: folderId,
      location: location,
    );
  }
}
