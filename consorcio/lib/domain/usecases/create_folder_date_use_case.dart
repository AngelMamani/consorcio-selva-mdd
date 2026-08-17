import '../entities/app_user.dart';
import '../entities/folder_date.dart';
import '../errors/domain_exception.dart';
import '../repositories/folder_date_repository.dart';
import '../repositories/image_folder_repository.dart';

class CreateFolderDateUseCase {
  CreateFolderDateUseCase(this._folderRepository, this._dateRepository);

  final ImageFolderRepository _folderRepository;
  final FolderDateRepository _dateRepository;

  Future<FolderDate> execute(
    AppUser actor, {
    required String folderId,
    required String dateKey,
    String note = '',
  }) async {
    actor.assertCanOperateApp();

    final folder = await _folderRepository.getById(folderId);
    if (folder == null) {
      throw DomainException('Carpeta no encontrada');
    }
    if (!folder.canBeAccessedBy(actor.id)) {
      throw DomainException('No tienes acceso a esta carpeta');
    }

    final key = dateKey.trim().isEmpty
        ? FolderDate.toDateKey(DateTime.now())
        : dateKey.trim();
    if (!FolderDate.isDateKey(key)) {
      throw DomainException('La fecha no es válida');
    }

    final existing =
        await _dateRepository.findByFolderAndDateKey(folderId, key);
    if (existing != null) {
      throw DomainException('Ya existe esa fecha en esta carpeta');
    }

    final trimmedNote = note.trim();
    if (trimmedNote.length > 200) {
      throw DomainException('La nota no debe superar 200 caracteres');
    }

    return _dateRepository.create(
      CreateFolderDateInput(
        folderId: folderId,
        dateKey: key,
        note: trimmedNote,
        createdById: actor.id,
        createdByName: actor.displayName,
      ),
    );
  }
}
