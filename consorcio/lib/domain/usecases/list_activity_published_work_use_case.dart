import '../entities/app_user.dart';
import '../entities/folder_date.dart';
import '../entities/technician_activity_work.dart';
import '../errors/domain_exception.dart';
import '../repositories/area_repository.dart';
import '../repositories/folder_date_repository.dart';
import '../repositories/folder_image_repository.dart';
import '../repositories/image_folder_repository.dart';
import '../repositories/user_repository.dart';
import '../value_objects/user_role.dart';

class ListActivityPublishedWorkUseCase {
  ListActivityPublishedWorkUseCase(
    this._areaRepository,
    this._folderRepository,
    this._dateRepository,
    this._imageRepository,
    this._userRepository,
  );

  final AreaRepository _areaRepository;
  final ImageFolderRepository _folderRepository;
  final FolderDateRepository _dateRepository;
  final FolderImageRepository _imageRepository;
  final UserRepository _userRepository;

  Future<ActivityPublishedWorkResult> execute(
    AppUser actor,
    String areaId,
  ) async {
    actor.assertCanOperateApp();
    final trimmed = areaId.trim();
    if (trimmed.isEmpty) {
      throw DomainException('Actividad inválida');
    }

    final area = await _areaRepository.getById(trimmed);
    if (area == null) {
      throw DomainException('Actividad no encontrada');
    }

    final folders = actor.isMobileAdmin
        ? await _folderRepository.listByArea(trimmed)
        : await _folderRepository.listAccessibleForUserAndArea(
            userId: actor.id,
            areaId: trimmed,
          );
    final technicians = await _userRepository.listTechnicians();
    final folderIds = folders.map((folder) => folder.id).toList();

    final allImages = await _imageRepository.listByFolderIds(folderIds);
    final images = actor.isMobileAdmin
        ? allImages
        : allImages
            .where((image) => image.uploadedById == actor.id)
            .toList();
    final dates = await _dateRepository.listByFolderIds(folderIds);
    final folderById = {for (final folder in folders) folder.id: folder};
    final dateById = {for (final date in dates) date.id: date};

    final worksByKey = <String, PublishedTechnicianWork>{};
    for (final image in images) {
      final technicianId = image.uploadedById.trim();
      if (technicianId.isEmpty) continue;
      final dateId = image.dateId.trim();
      if (dateId.isEmpty) continue;
      final folder = folderById[image.folderId];
      if (folder == null) continue;
      final dateKey = dateById[image.dateId]?.dateKey ??
          FolderDate.toDateKey(image.createdAt);
      final key = '$technicianId|${image.folderId}|$dateId';
      final existing = worksByKey[key];
      if (existing != null) {
        final later = image.createdAt.isAfter(existing.publishedAt);
        worksByKey[key] = PublishedTechnicianWork(
          technicianId: existing.technicianId,
          technicianName: existing.technicianName,
          folderId: existing.folderId,
          dateId: existing.dateId,
          routeCode: existing.routeCode,
          folderName: existing.folderName,
          dateKey: existing.dateKey,
          imageCount: existing.imageCount + 1,
          publishedAt: later ? image.createdAt : existing.publishedAt,
        );
        continue;
      }
      worksByKey[key] = PublishedTechnicianWork(
        technicianId: technicianId,
        technicianName: image.uploadedByName.trim().isEmpty
            ? 'Técnico'
            : image.uploadedByName.trim(),
        folderId: image.folderId,
        dateId: dateId,
        routeCode: folder.routeCode ?? '',
        folderName: folder.name,
        dateKey: dateKey,
        imageCount: 1,
        publishedAt: image.createdAt,
      );
    }

    final works = worksByKey.values.toList()
      ..sort((left, right) {
        final byDate = right.dateKey.compareTo(left.dateKey);
        if (byDate != 0) return byDate;
        return (left.routeCode.isEmpty ? left.folderName : left.routeCode)
            .compareTo(
          right.routeCode.isEmpty ? right.folderName : right.routeCode,
        );
      });

    final stats = <String, ActivityTechnicianFolder>{};
    for (final work in works) {
      final current = stats[work.technicianId];
      final last = current?.lastPublishedAt;
      stats[work.technicianId] = ActivityTechnicianFolder(
        technicianId: work.technicianId,
        technicianName: work.technicianName,
        workCount: (current?.workCount ?? 0) + 1,
        imageCount: (current?.imageCount ?? 0) + work.imageCount,
        lastPublishedAt: last == null || work.publishedAt.isAfter(last)
            ? work.publishedAt
            : last,
      );
    }

    final technicianFolders = <String, ActivityTechnicianFolder>{};
    for (final technician in technicians) {
      if (!technician.active) continue;
      if (!technician.assignedRoles.contains(UserRole.tecnico)) continue;
      final current = stats[technician.id];
      technicianFolders[technician.id] = ActivityTechnicianFolder(
        technicianId: technician.id,
        technicianName: technician.displayName,
        workCount: current?.workCount ?? 0,
        imageCount: current?.imageCount ?? 0,
        lastPublishedAt: current?.lastPublishedAt,
      );
    }
    for (final entry in stats.entries) {
      technicianFolders.putIfAbsent(entry.key, () => entry.value);
    }

    final technicianList = technicianFolders.values.toList()
      ..sort((left, right) {
        if (right.workCount != left.workCount) {
          return right.workCount.compareTo(left.workCount);
        }
        return left.technicianName.compareTo(right.technicianName);
      });

    return ActivityPublishedWorkResult(
      areaId: area.id,
      areaName: area.name,
      technicians: technicianList,
      works: works,
    );
  }
}
