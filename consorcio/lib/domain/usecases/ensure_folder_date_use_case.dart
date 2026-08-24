import '../entities/app_user.dart';
import '../entities/folder_date.dart';
import '../errors/domain_exception.dart';
import '../repositories/folder_date_repository.dart';
import '../repositories/image_folder_repository.dart';

class EnsureFolderDateUseCase {
  EnsureFolderDateUseCase(this._folderRepository, this._dateRepository);

  final ImageFolderRepository _folderRepository;
  final FolderDateRepository _dateRepository;

  Future<FolderDate> execute(
    AppUser actor, {
    required String folderId,
    String? dateKey,
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

    final key = (dateKey ?? '').trim().isEmpty
        ? FolderDate.toDateKey(DateTime.now())
        : dateKey!.trim();
    if (!FolderDate.isDateKey(key)) {
      throw DomainException('La fecha no es válida');
    }

    final existing =
        await _dateRepository.findByFolderAndDateKey(folderId, key);
    if (existing != null) return existing;

    final trimmedNote = note.trim();
    if (trimmedNote.length > 200) {
      throw DomainException('La nota no debe superar 200 caracteres');
    }

    try {
      return await _dateRepository.create(
        CreateFolderDateInput(
          folderId: folderId,
          dateKey: key,
          note: trimmedNote,
          createdById: actor.id,
          createdByName: actor.displayName,
        ),
      );
    } catch (_) {
      final raced =
          await _dateRepository.findByFolderAndDateKey(folderId, key);
      if (raced != null) return raced;
      rethrow;
    }
  }
}
