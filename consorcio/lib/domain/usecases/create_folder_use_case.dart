import '../entities/app_user.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/image_folder_repository.dart';
import '../value_objects/geo_location.dart';

class CreateFolderUseCase {
  CreateFolderUseCase(this._folderRepository);
  final ImageFolderRepository _folderRepository;

  Future<ImageFolder> execute(
    AppUser actor, {
    required String name,
    required String description,
    required GeoLocation location,
  }) async {
    actor.assertCanOperateApp();

    final cleanName = name.trim();
    if (cleanName.isEmpty) {
      throw DomainException('El nombre de la carpeta es obligatorio');
    }
    if (!location.isValid) {
      throw DomainException('La ubicación GPS no es válida');
    }

    return _folderRepository.create(
      CreateImageFolderInput(
        name: cleanName,
        description: description.trim(),
        ownerId: actor.id,
        ownerName: actor.displayName,
        location: location,
      ),
    );
  }
}
