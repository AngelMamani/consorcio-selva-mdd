import '../entities/app_user.dart';
import '../entities/folder_date.dart';
import '../entities/folder_image.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/folder_image_repository.dart';
import '../value_objects/geo_location.dart';
import 'ensure_folder_date_use_case.dart';
import 'ensure_supply_folder_use_case.dart';
import 'upload_folder_images_use_case.dart';

class UploadSupplyPhotosResult {
  const UploadSupplyPhotosResult({
    required this.folder,
    required this.folderDate,
    required this.images,
  });

  final ImageFolder folder;
  final FolderDate folderDate;
  final List<FolderImage> images;
}

/// Crea (si falta) la carpeta del suministro + la de hoy, y sube las fotos.
class UploadSupplyPhotosUseCase {
  UploadSupplyPhotosUseCase(
    this._ensureSupplyFolderUseCase,
    this._ensureFolderDateUseCase,
    this._uploadFolderImagesUseCase,
  );

  final EnsureSupplyFolderUseCase _ensureSupplyFolderUseCase;
  final EnsureFolderDateUseCase _ensureFolderDateUseCase;
  final UploadFolderImagesUseCase _uploadFolderImagesUseCase;

  Future<UploadSupplyPhotosResult> execute(
    AppUser actor, {
    required String areaId,
    required String routeCode,
    String areaName = '',
    required List<ImageFilePayload> files,
    String note = '',
    GeoLocation? location,
    void Function(String status)? onStatus,
    void Function(int current, int total)? onProgress,
  }) async {
    actor.assertCanOperateApp();

    final trimmedAreaId = areaId.trim();
    if (trimmedAreaId.isEmpty) {
      throw DomainException('Elige la actividad (área) para guardar las fotos');
    }

    final code = routeCode.trim();
    if (code.isEmpty) {
      throw DomainException('Falta el código de suministro');
    }

    if (files.isEmpty) {
      throw DomainException('Selecciona al menos una imagen');
    }

    onStatus?.call('Preparando carpeta del suministro...');
    final folder = await _ensureSupplyFolderUseCase.execute(
      actor,
      areaId: trimmedAreaId,
      routeCode: code,
      areaName: areaName,
    );

    onStatus?.call('Creando carpeta de hoy...');
    final trimmedNote = note.trim();
    final rawNote = trimmedNote.isEmpty
        ? 'Fotos de campo · suministro $code'
        : trimmedNote;
    final folderDate = await _ensureFolderDateUseCase.execute(
      actor,
      folderId: folder.id,
      dateKey: FolderDate.toDateKey(DateTime.now()),
      note: rawNote.length > 200 ? rawNote.substring(0, 200) : rawNote,
    );

    onStatus?.call('Subiendo fotos...');
    final images = await _uploadFolderImagesUseCase.execute(
      actor,
      folderId: folder.id,
      dateId: folderDate.id,
      files: files,
      location: location,
      onProgress: onProgress,
    );

    return UploadSupplyPhotosResult(
      folder: folder,
      folderDate: folderDate,
      images: images,
    );
  }
}
