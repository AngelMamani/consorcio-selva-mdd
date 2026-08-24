import '../entities/app_user.dart';
import '../entities/field_task.dart';
import '../entities/folder_date.dart';
import '../entities/folder_image.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/folder_image_repository.dart';
import '../value_objects/geo_location.dart';
import 'ensure_folder_date_use_case.dart';
import 'ensure_supply_folder_use_case.dart';
import 'upload_folder_images_use_case.dart';

class UploadTaskPhotosResult {
  const UploadTaskPhotosResult({
    required this.folder,
    required this.folderDate,
    required this.images,
  });

  final ImageFolder folder;
  final FolderDate folderDate;
  final List<FolderImage> images;
}

class UploadTaskPhotosUseCase {
  UploadTaskPhotosUseCase(
    this._ensureSupplyFolderUseCase,
    this._ensureFolderDateUseCase,
    this._uploadFolderImagesUseCase,
  );

  final EnsureSupplyFolderUseCase _ensureSupplyFolderUseCase;
  final EnsureFolderDateUseCase _ensureFolderDateUseCase;
  final UploadFolderImagesUseCase _uploadFolderImagesUseCase;

  Future<UploadTaskPhotosResult> execute(
    AppUser actor, {
    required FieldTask task,
    required List<ImageFilePayload> files,
    GeoLocation? location,
    void Function(String status)? onStatus,
    void Function(int current, int total)? onProgress,
  }) async {
    actor.assertCanOperateApp();

    final areaId = task.areaId.trim();
    if (areaId.isEmpty) {
      throw DomainException(
        'Esta tarea no tiene actividad. Pide al admin que la asigne a una actividad.',
      );
    }

    final routeCode = task.routeCode.trim();
    if (routeCode.isEmpty) {
      throw DomainException('Esta tarea no tiene código de suministro');
    }

    if (files.isEmpty) {
      throw DomainException('Selecciona al menos una imagen');
    }

    onStatus?.call('Preparando carpeta del suministro...');
    final folder = await _ensureSupplyFolderUseCase.execute(
      actor,
      areaId: areaId,
      routeCode: routeCode,
      areaName: task.areaName,
    );

    onStatus?.call('Creando carpeta de hoy...');
    final rawNote = 'Fotos de tarea: ${task.title}';
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

    return UploadTaskPhotosResult(
      folder: folder,
      folderDate: folderDate,
      images: images,
    );
  }
}
