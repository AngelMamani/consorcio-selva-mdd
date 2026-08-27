import '../entities/app_user.dart';
import '../entities/folder_date.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/folder_date_repository.dart';
import '../repositories/folder_image_repository.dart';
import '../repositories/image_folder_repository.dart';

class GetFolderDetailUseCase {
  GetFolderDetailUseCase(
    this._folderRepository,
    this._dateRepository,
    this._imageRepository,
  );

  final ImageFolderRepository _folderRepository;
  final FolderDateRepository _dateRepository;
  final FolderImageRepository _imageRepository;

  Future<({ImageFolder folder, List<FolderDate> dates})> execute(
    AppUser actor,
    String folderId,
  ) async {
    actor.assertCanOperateApp();

    final folder = await _folderRepository.getById(folderId);
    if (folder == null) {
      throw DomainException('Carpeta no encontrada');
    }
    if (!folder.canBeAccessedBy(actor.id)) {
      throw DomainException('No tienes acceso a esta carpeta');
    }

    var dates = await _dateRepository.listByFolder(folderId);
    var nextFolder = folder;
    if (!actor.isMobileAdmin) {
      final images = await _imageRepository.listByFolder(folderId);
      final byDate = <String, int>{};
      var total = 0;
      for (final image in images) {
        if (image.uploadedById != actor.id) continue;
        byDate[image.dateId] = (byDate[image.dateId] ?? 0) + 1;
        total += 1;
      }
      dates = [
        for (final date in dates) date.copyWith(imageCount: byDate[date.id] ?? 0),
      ];
      nextFolder = folder.copyWith(imageCount: total);
    }
    return (folder: nextFolder, dates: dates);
  }
}
