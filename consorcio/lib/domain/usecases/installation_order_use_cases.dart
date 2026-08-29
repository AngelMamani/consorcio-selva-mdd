import '../entities/app_user.dart';
import '../entities/installation_order.dart';
import '../repositories/installation_order_repository.dart';

class ListInstallationOrdersUseCase {
  ListInstallationOrdersUseCase(this._repository);

  final InstallationOrderRepository _repository;

  Stream<List<InstallationOrder>> watchByArea(AppUser actor, String areaId) {
    actor.assertCanOperateApp();
    if (actor.isMobileAdmin) {
      return _repository.watchByArea(areaId);
    }
    return _repository.watchAssignedTo(actor.id).map(
          (orders) =>
              orders.where((item) => item.areaId == areaId).toList(),
        );
  }

  Stream<List<InstallationOrder>> watchMine(AppUser actor) {
    actor.assertCanOperateApp();
    return _repository.watchAssignedTo(actor.id);
  }
}
