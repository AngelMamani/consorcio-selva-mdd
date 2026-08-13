import '../value_objects/geo_location.dart';

class ImageFolder {
  const ImageFolder({
    required this.id,
    required this.name,
    required this.description,
    required this.ownerId,
    required this.ownerName,
    required this.imageCount,
    required this.createdAt,
    required this.updatedAt,
    this.location,
  });

  final String id;
  final String name;
  final String description;
  final String ownerId;
  final String ownerName;
  final int imageCount;
  final GeoLocation? location;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get hasLocation => location != null && location!.isValid;
}
