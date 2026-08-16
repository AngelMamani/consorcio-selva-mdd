import '../entities/app_user.dart';
import '../entities/image_folder.dart';
import '../errors/domain_exception.dart';
import '../repositories/image_folder_repository.dart';
import '../repositories/user_repository.dart';
import 'create_folder_use_case.dart';

class UpdateFolderUseCase {
  UpdateFolderUseCase(this._folderRepository, this._userRepository);
  final ImageFolderRepository _folderRepository;
  final UserRepository _userRepository;

  Future<ImageFolder> execute(
    AppUser actor, {
    required String folderId,
    required String name,
    required String description,
    required bool assignToAllTechnicians,
    required List<String> assignedTechnicianIds,
  }) async {
    actor.assertCanOperateApp();

    final folder = await _folderRepository.getById(folderId);
    if (folder == null) {
      throw DomainException('Carpeta no encontrada');
    }
    if (!folder.canBeAccessedBy(actor.id)) {
      throw DomainException('No puedes editar esta carpeta');
    }

    final cleanName = name.trim();
    if (cleanName.isEmpty) {
      throw DomainException('El nombre de la carpeta es obligatorio');
    }

    final assignment = await resolveFolderAssignments(
      userRepository: _userRepository,
      actor: actor,
      assignToAllTechnicians: assignToAllTechnicians,
      assignedTechnicianIds: assignedTechnicianIds,
    );

    return _folderRepository.update(
      id: folderId,
      name: cleanName,
      description: description.trim(),
      assignToAllTechnicians: assignment.assignToAll,
      assignedTechnicianIds: assignment.ids,
      assignedTechnicianNames: assignment.names,
    );
  }
}
