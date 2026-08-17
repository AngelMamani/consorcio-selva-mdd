import '../entities/folder_date.dart';

class CreateFolderDateInput {
  const CreateFolderDateInput({
    required this.folderId,
    required this.dateKey,
    required this.note,
    required this.createdById,
    required this.createdByName,
  });

  final String folderId;
  final String dateKey;
  final String note;
  final String createdById;
  final String createdByName;
}

abstract class FolderDateRepository {
  Future<FolderDate?> getById(String id);
  Future<List<FolderDate>> listByFolder(String folderId);
  Future<FolderDate?> findByFolderAndDateKey(String folderId, String dateKey);
  Future<FolderDate> create(CreateFolderDateInput input);
  Future<void> incrementImageCount(String dateId, int delta);
}
