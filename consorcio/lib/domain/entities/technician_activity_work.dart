class ActivityTechnicianFolder {
  const ActivityTechnicianFolder({
    required this.technicianId,
    required this.technicianName,
    required this.workCount,
    required this.imageCount,
    this.lastPublishedAt,
  });

  final String technicianId;
  final String technicianName;
  final int workCount;
  final int imageCount;
  final DateTime? lastPublishedAt;
}

class PublishedTechnicianWork {
  const PublishedTechnicianWork({
    required this.technicianId,
    required this.technicianName,
    required this.folderId,
    required this.dateId,
    required this.routeCode,
    required this.folderName,
    required this.dateKey,
    required this.imageCount,
    required this.publishedAt,
  });

  final String technicianId;
  final String technicianName;
  final String folderId;
  final String dateId;
  final String routeCode;
  final String folderName;
  final String dateKey;
  final int imageCount;
  final DateTime publishedAt;
}

class ActivityPublishedWorkResult {
  const ActivityPublishedWorkResult({
    required this.areaId,
    required this.areaName,
    required this.technicians,
    required this.works,
  });

  final String areaId;
  final String areaName;
  final List<ActivityTechnicianFolder> technicians;
  final List<PublishedTechnicianWork> works;
}
