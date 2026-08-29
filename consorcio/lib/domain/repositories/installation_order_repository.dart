import '../entities/installation_order.dart';

abstract class InstallationOrderRepository {
  Stream<List<InstallationOrder>> watchByArea(String areaId);
  Stream<List<InstallationOrder>> watchAssignedTo(String technicianId);
}
