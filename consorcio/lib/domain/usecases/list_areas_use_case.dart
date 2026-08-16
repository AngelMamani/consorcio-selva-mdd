import '../entities/app_user.dart';
import '../entities/area.dart';
import '../errors/domain_exception.dart';
import '../repositories/area_repository.dart';

class ListAreasUseCase {
  ListAreasUseCase(this._areaRepository);
  final AreaRepository _areaRepository;

  Future<List<Area>> execute(AppUser actor) async {
    actor.assertCanOperateApp();
    return _areaRepository.listAll();
  }
}

class GetAreaUseCase {
  GetAreaUseCase(this._areaRepository);
  final AreaRepository _areaRepository;

  Future<Area> execute(AppUser actor, String areaId) async {
    actor.assertCanOperateApp();
    final area = await _areaRepository.getById(areaId);
    if (area == null) {
      throw DomainException('Área no encontrada');
    }
    return area;
  }
}
