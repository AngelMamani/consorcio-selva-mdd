import '../entities/app_user.dart';
import '../entities/area.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/area_repository.dart';
import '../repositories/image_folder_repository.dart';
import '../repositories/supply_repository.dart';
import '../services/supply_folder_service.dart';
import '../usecases/search_supplies_use_case.dart';
import '../value_objects/geo_location.dart';

class EnsureSupplyFolderUseCase {
  EnsureSupplyFolderUseCase(
    this._folderRepository,
    this._areaRepository,
    this._supplyRepository,
  );

  final ImageFolderRepository _folderRepository;
  final AreaRepository _areaRepository;
  final SupplyRepository _supplyRepository;

  Future<ImageFolder> execute(
    AppUser actor, {
    required String areaId,
    required String routeCode,
    String? areaName,
  }) async {
    actor.assertCanOperateApp();

    final code = normalizeRouteCode(routeCode);
    if (!isRouteCode(code)) {
      throw DomainException('Ingresa un código de suministro válido');
    }

    final trimmedAreaId = areaId.trim();
    if (trimmedAreaId.isEmpty) {
      throw DomainException('Debes indicar el área');
    }

    final folderId = supplyFolderDocId(trimmedAreaId, code);
    final hintName = areaName?.trim();

    final existingFuture = _folderRepository.getById(folderId);
    final supplyFuture = _supplyRepository.getByRouteCode(code);
    final areaFuture = hintName == null || hintName.isEmpty
        ? _areaRepository.getById(trimmedAreaId)
        : Future<Area?>.value(null);

    final existing = await existingFuture;
    if (existing != null) {
      if (!existing.canBeAccessedBy(actor.id)) {
        throw DomainException('No tienes permiso para ver esta carpeta');
      }
      return existing;
    }

    final supply = await supplyFuture;
    if (supply == null) {
      throw DomainException('No hay suministro con ese código');
    }

    final resolvedName = hintName?.isNotEmpty == true
        ? hintName!
        : (await areaFuture)?.name ?? '';
    if (resolvedName.isEmpty) {
      throw DomainException('Área no encontrada');
    }

    return _folderRepository.create(
      CreateImageFolderInput(
        id: folderId,
        areaId: trimmedAreaId,
        areaName: resolvedName,
        name: code,
        description: 'Suministro',
        ownerId: actor.id,
        ownerName: actor.displayName,
        assignToAllTechnicians: true,
        assignedTechnicianIds: const [],
        assignedTechnicianNames: const [],
        routeCode: code,
        location: supply.hasLocation
            ? GeoLocation(
                latitude: supply.latitude!,
                longitude: supply.longitude!,
              )
            : null,
      ),
    );
  }
}
