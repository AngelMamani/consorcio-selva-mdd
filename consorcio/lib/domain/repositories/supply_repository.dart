import '../entities/supply.dart';

abstract class SupplyRepository {
  Future<Supply?> getByRouteCode(String routeCode);
  Future<List<Supply>> searchByPrefix(String prefix, {int limit = 20});
  Future<List<Supply>> listNear({
    required double latitude,
    required double longitude,
    required double radiusMeters,
    int limit = 250,
  });
  Future<Sed?> getSedByCode(String code);
  Future<List<Sed>> searchSedsByPrefix(String prefix, {int limit = 12});
  Future<SupplyCatalogStatus?> getCatalogStatus();
}
