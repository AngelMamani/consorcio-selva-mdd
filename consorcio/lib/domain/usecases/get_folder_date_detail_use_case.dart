import '../entities/app_user.dart';
import '../entities/folder_date.dart';
import '../entities/folder_image.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/folder_date_repository.dart';
import '../repositories/folder_image_repository.dart';
import '../repositories/image_folder_repository.dart';

class GetFolderDateDetailUseCase {
  GetFolderDateDetailUseCase(
    this._folderRepository,
    this._dateRepository,
    this._imageRepository,
  );

  final ImageFolderRepository _folderRepository;
  final FolderDateRepository _dateRepository;
  final FolderImageRepository _imageRepository;

  Future<
      ({
        ImageFolder folder,
        FolderDate folderDate,
        List<FolderImage> images,
      })> execute(
    AppUser actor, {
    required String folderId,
    required String dateId,
  }) async {
    actor.assertCanOperateApp();

    final folder = await _folderRepository.getById(folderId);
    if (folder == null) {
      throw DomainException('Carpeta no encontrada');
    }
    if (!folder.canBeAccessedBy(actor.id)) {
      throw DomainException('No tienes acceso a esta carpeta');
    }

    final folderDate = await _dateRepository.getById(dateId);
    if (folderDate == null || folderDate.folderId != folderId) {
      throw DomainException('Fecha no encontrada');
    }

    final images = await _imageRepository.listByDate(folderId, dateId);
    return (folder: folder, folderDate: folderDate, images: images);
  }
}
