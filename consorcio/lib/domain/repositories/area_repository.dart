import '../entities/area.dart';

abstract class AreaRepository {
  Future<List<Area>> listAll();
  Future<Area?> getById(String id);
}
