import '../entities/app_user.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/area_repository.dart';
import '../repositories/image_folder_repository.dart';
import '../repositories/user_repository.dart';
import '../value_objects/geo_location.dart';
import '../value_objects/user_role.dart';

class CreateFolderUseCase {
  CreateFolderUseCase(
    this._folderRepository,
    this._areaRepository,
    this._userRepository,
  );
  final ImageFolderRepository _folderRepository;
  final AreaRepository _areaRepository;
  final UserRepository _userRepository;

  Future<List<AppUser>> listTechniciansForAssignment() {
    return _userRepository.listTechnicians();
  }

  Future<ImageFolder> execute(
    AppUser actor, {
    required String areaId,
    required String name,
    required String description,
    required GeoLocation location,
    required bool assignToAllTechnicians,
    required List<String> assignedTechnicianIds,
  }) async {
    actor.assertCanOperateApp();

    final cleanName = name.trim();
    if (cleanName.isEmpty) {
      throw DomainException('El nombre de la carpeta es obligatorio');
    }
    if (!location.isValid) {
      throw DomainException('La ubicación GPS no es válida');
    }

    final area = await _areaRepository.getById(areaId);
    if (area == null) {
      throw DomainException('Área no encontrada');
    }

    final assignment = await resolveFolderAssignments(
      userRepository: _userRepository,
      actor: actor,
      assignToAllTechnicians: assignToAllTechnicians,
      assignedTechnicianIds: assignedTechnicianIds,
    );

    return _folderRepository.create(
      CreateImageFolderInput(
        areaId: area.id,
        areaName: area.name,
        name: cleanName,
        description: description.trim(),
        ownerId: actor.id,
        ownerName: actor.displayName,
        assignToAllTechnicians: assignment.assignToAll,
        assignedTechnicianIds: assignment.ids,
        assignedTechnicianNames: assignment.names,
        location: location,
      ),
    );
  }
}

class FolderAssignmentResult {
  const FolderAssignmentResult({
    required this.assignToAll,
    required this.ids,
    required this.names,
  });

  final bool assignToAll;
  final List<String> ids;
  final List<String> names;
}

Future<FolderAssignmentResult> resolveFolderAssignments({
  required UserRepository userRepository,
  required AppUser actor,
  required bool assignToAllTechnicians,
  required List<String> assignedTechnicianIds,
}) async {
  if (assignToAllTechnicians) {
    return const FolderAssignmentResult(
      assignToAll: true,
      ids: [],
      names: [],
    );
  }

  final uniqueIds = <String>{
    ...assignedTechnicianIds.map((id) => id.trim()).where((id) => id.isNotEmpty),
  };
  uniqueIds.add(actor.id);

  if (uniqueIds.isEmpty) {
    throw DomainException(
      'Selecciona al menos un técnico o elige “Todos los técnicos”',
    );
  }

  final technicians = await userRepository.listTechnicians();
  final byId = {
    for (final tech in technicians)
      if (tech.role == UserRole.tecnico && tech.active) tech.id: tech,
  };

  final ids = <String>[];
  final names = <String>[];
  for (final id in uniqueIds) {
    final tech = byId[id];
    if (tech == null) {
      throw DomainException('Hay un técnico inválido o inactivo en la asignación');
    }
    ids.add(tech.id);
    names.add(tech.displayName);
  }

  return FolderAssignmentResult(
    assignToAll: false,
    ids: ids,
    names: names,
  );
}
