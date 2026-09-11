import '../entities/app_user.dart';
import '../entities/field_task.dart';
import '../entities/folder_date.dart';
import '../entities/folder_image.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/folder_image_repository.dart';
import '../value_objects/geo_location.dart';
import 'upload_supply_photos_use_case.dart';

class UploadTaskPhotosResult {
  const UploadTaskPhotosResult({
    required this.folder,
    required this.folderDate,
    required this.images,
  });

  final ImageFolder folder;
  final FolderDate folderDate;
  final List<FolderImage> images;

  factory UploadTaskPhotosResult.fromSupply(UploadSupplyPhotosResult result) {
    return UploadTaskPhotosResult(
      folder: result.folder,
      folderDate: result.folderDate,
      images: result.images,
    );
  }
}

class UploadTaskPhotosUseCase {
  UploadTaskPhotosUseCase(this._uploadSupplyPhotosUseCase);

  final UploadSupplyPhotosUseCase _uploadSupplyPhotosUseCase;

  Future<UploadTaskPhotosResult> execute(
    AppUser actor, {
    required FieldTask task,
    String? routeCode,
    required List<ImageFilePayload> files,
    String note = '',
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

    final selectedRoute = (routeCode ?? task.routeCode).trim();
    if (selectedRoute.isEmpty) {
      throw DomainException('Esta tarea no tiene código de suministro');
    }

    final trimmedNote = note.trim();
    final result = await _uploadSupplyPhotosUseCase.execute(
      actor,
      areaId: areaId,
      areaName: task.areaName,
      routeCode: selectedRoute,
      files: files,
      note: trimmedNote.isEmpty
          ? 'Fotos de tarea: ${task.title}'
          : trimmedNote,
      location: location,
      onStatus: onStatus,
      onProgress: onProgress,
    );

    return UploadTaskPhotosResult.fromSupply(result);
  }
}
