import '../entities/app_user.dart';
import '../entities/supply.dart';
import '../errors/domain_exception.dart';
import '../repositories/supply_repository.dart';
import '../services/geo_distance_service.dart';
import '../services/supply_search_service.dart';

String normalizeRouteCode(String value) {
  return value.replaceAll(RegExp(r'\D'), '');
}

bool isRouteCode(String value) {
  return RegExp(r'^\d{7,12}$').hasMatch(value);
}

class GetSupplyByRouteCodeUseCase {
  GetSupplyByRouteCodeUseCase(this._supplyRepository);

  final SupplyRepository _supplyRepository;

  Future<Supply> execute(AppUser actor, String routeCode) async {
    actor.assertCanOperateApp();
    final code = normalizeRouteCode(routeCode);
    if (!isRouteCode(code)) {
      throw DomainException('Ingresa un código de ruta válido');
    }
    final supply = await _supplyRepository.getByRouteCode(code);
    if (supply == null) {
      throw DomainException('No hay estación con ese código de ruta');
    }
    return supply;
  }
}

Future<List<Supply>> _searchSuppliesFlexible(
  SupplyRepository supplyRepository,
  String query, {
  required int limit,
}) async {
  final expansion = expandSupplySearch(query);
  if (expansion.digits.length > 12) {
    throw DomainException('El código de ruta es demasiado largo');
  }
  if (expansion.prefixes.isEmpty && expansion.exactCodes.isEmpty) {
    return const [];
  }

  final results = await Future.wait([
    Future.wait(
      expansion.prefixes.map(
        (prefix) => supplyRepository.searchByPrefix(prefix, limit: limit),
      ),
    ),
    Future.wait(
      expansion.exactCodes.map(supplyRepository.getByRouteCode),
    ),
  ]);
  final prefixGroups = results[0] as List<List<Supply>>;
  final exactHits = results[1] as List<Supply?>;

  final byCode = <String, Supply>{};
  for (final supply in exactHits) {
    if (supply != null) byCode[supply.routeCode] = supply;
  }
  for (final group in prefixGroups) {
    for (final supply in group) {
      byCode[supply.routeCode] = supply;
    }
  }

  final matches = byCode.values
      .where((supply) => supplyCodeMatchesQuery(supply.routeCode, expansion.digits))
      .toList()
    ..sort((left, right) {
      final leftScore = scoreSupplyCode(left.routeCode, expansion.digits);
      final rightScore = scoreSupplyCode(right.routeCode, expansion.digits);
      if (leftScore != rightScore) return leftScore.compareTo(rightScore);
      return left.routeCode.compareTo(right.routeCode);
    });
  if (matches.length <= limit) return matches;
  return matches.take(limit).toList();
}

class SearchSuppliesUseCase {
  SearchSuppliesUseCase(this._supplyRepository);

  final SupplyRepository _supplyRepository;

  Future<List<Supply>> execute(AppUser actor, String query) {
    actor.assertCanOperateApp();
    return _searchSuppliesFlexible(_supplyRepository, query, limit: 20);
  }
}

class ListSupplyCatalogUseCase {
  ListSupplyCatalogUseCase(this._supplyRepository);

  final SupplyRepository _supplyRepository;

  Future<List<Supply>> execute(AppUser actor, String query, {int limit = 48}) {
    actor.assertCanOperateApp();
    return _searchSuppliesFlexible(_supplyRepository, query, limit: limit);
  }
}

class GetSupplyCatalogStatusUseCase {
  GetSupplyCatalogStatusUseCase(this._supplyRepository);

  final SupplyRepository _supplyRepository;

  Future<SupplyCatalogStatus?> execute(AppUser actor) {
    actor.assertCanOperateApp();
    return _supplyRepository.getCatalogStatus();
  }
}

StationHit _fromSupply(Supply supply) {
  return StationHit(
    kind: 'supply',
    code: supply.routeCode,
    detail: 'Suministro · código de ruta',
    latitude: supply.latitude,
    longitude: supply.longitude,
  );
}

StationHit _fromSed(Sed sed) {
  return StationHit(
    kind: 'sed',
    code: sed.code,
    detail: sed.name,
    latitude: sed.latitude,
    longitude: sed.longitude,
  );
}

class GetStationByCodeUseCase {
  GetStationByCodeUseCase(this._supplyRepository);

  final SupplyRepository _supplyRepository;

  Future<StationHit> execute(AppUser actor, String routeCode) async {
    actor.assertCanOperateApp();
    final code = normalizeRouteCode(routeCode);
    final expansion = expandSupplySearch(routeCode);
    if (RegExp(r'^20\d{5}$').hasMatch(code)) {
      final sed = await _supplyRepository.getSedByCode(code);
      if (sed != null) return _fromSed(sed);
    }

    final candidates = {code, ...expansion.exactCodes}.where(isRouteCode);
    for (final candidate in candidates) {
      final supply = await _supplyRepository.getByRouteCode(candidate);
      if (supply != null) return _fromSupply(supply);
    }

    final sed = await _supplyRepository.getSedByCode(code);
    if (sed != null) return _fromSed(sed);

    throw DomainException('No hay suministro ni SED con ese código');
  }
}

class SearchStationsUseCase {
  SearchStationsUseCase(this._supplyRepository);

  final SupplyRepository _supplyRepository;

  Future<List<StationHit>> execute(AppUser actor, String query) async {
    actor.assertCanOperateApp();
    final expansion = expandSupplySearch(query);
    if (expansion.digits.length > 12) {
      throw DomainException('El código es demasiado largo');
    }
    if (expansion.prefixes.isEmpty) {
      return const [];
    }

    final supplies = await _searchSuppliesFlexible(
      _supplyRepository,
      query,
      limit: 12,
    );
    final sedGroups = await Future.wait(
      expansion.prefixes.map(_supplyRepository.searchSedsByPrefix),
    );
    final seds = {for (final sed in sedGroups.expand((group) => group)) sed.code: sed}.values;
    final hits = <StationHit>[
      ...seds.map(_fromSed),
      ...supplies.map(_fromSupply),
    ];
    hits.sort((left, right) {
      final leftScore = scoreSupplyCode(left.code, expansion.digits);
      final rightScore = scoreSupplyCode(right.code, expansion.digits);
      if (leftScore != rightScore) return leftScore.compareTo(rightScore);
      if (left.kind != right.kind) return left.kind == 'sed' ? -1 : 1;
      return left.code.compareTo(right.code);
    });
    return hits.take(20).toList();
  }
}

class ListSuppliesNearUseCase {
  ListSuppliesNearUseCase(this._supplyRepository);

  final SupplyRepository _supplyRepository;

  Future<List<NearbySupply>> execute(
    AppUser actor, {
    required double latitude,
    required double longitude,
    double radiusMeters = sedFeederRadiusMeters,
  }) async {
    actor.assertCanOperateApp();
    final supplies = await _supplyRepository.listNear(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
    );
    final nearby = supplies
        .map(
          (supply) => NearbySupply(
            routeCode: supply.routeCode,
            latitude: supply.latitude,
            longitude: supply.longitude,
            distanceMeters: distanceMeters(
              latitudeA: latitude,
              longitudeA: longitude,
              latitudeB: supply.latitude,
              longitudeB: supply.longitude,
            ),
          ),
        )
        .toList()
      ..sort((left, right) => left.distanceMeters.compareTo(right.distanceMeters));
    return nearby;
  }
}
