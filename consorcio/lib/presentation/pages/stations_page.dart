import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/supply.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/usecases/search_supplies_use_case.dart';
import '../state/session_controller.dart';

class StationsPage extends StatefulWidget {
  const StationsPage({super.key});

  @override
  State<StationsPage> createState() => _StationsPageState();
}

class _StationsPageState extends State<StationsPage> {
  final _codeController = TextEditingController();
  final _focusNode = FocusNode();
  bool _searching = false;
  String? _error;
  StationHit? _selected;
  List<StationHit> _suggestions = const [];
  List<NearbySupply> _nearby = const [];
  bool _loadingNearby = false;
  SupplyCatalogStatus? _catalog;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadCatalog());
  }

  Future<void> _selectHit(StationHit? hit) async {
    setState(() {
      _selected = hit;
      _nearby = const [];
      _loadingNearby = hit?.isSed == true;
    });
    if (hit == null || !hit.isSed) return;

    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    try {
      final nearby = await deps.listSuppliesNearUseCase.execute(
        user,
        latitude: hit.latitude,
        longitude: hit.longitude,
      );
      if (!mounted || _selected?.code != hit.code) return;
      setState(() {
        _nearby = nearby;
        _loadingNearby = false;
      });
    } catch (_) {
      if (!mounted || _selected?.code != hit.code) return;
      setState(() {
        _nearby = const [];
        _loadingNearby = false;
      });
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _loadCatalog() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;
    try {
      final catalog =
          await deps.getSupplyCatalogStatusUseCase.execute(user);
      if (!mounted) return;
      setState(() => _catalog = catalog);
    } catch (_) {
      if (!mounted) return;
      setState(() => _catalog = null);
    }
  }

  Future<void> _search() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _searching) return;

    final code = normalizeRouteCode(_codeController.text);
    if (code.length < 4) {
      setState(() {
        _error = 'Escribe al menos 4 dígitos del código';
        _selected = null;
        _nearby = const [];
        _suggestions = const [];
      });
      return;
    }

    setState(() {
      _searching = true;
      _error = null;
    });

    try {
      if (code.length >= 7) {
        try {
          final hit =
              await deps.getStationByCodeUseCase.execute(user, code);
          if (!mounted) return;
          setState(() {
            _suggestions = const [];
            _searching = false;
          });
          await _selectHit(hit);
          return;
        } on DomainException {
          // Si no es exacto, se busca por prefijo.
        }
      }

      final found = await deps.searchStationsUseCase.execute(user, code);
      if (!mounted) return;
      setState(() {
        _suggestions = found;
        _searching = false;
        if (found.isEmpty) {
          _error = 'No hay suministro ni SED con ese código';
        }
      });
      await _selectHit(found.length == 1 ? found.first : null);
    } on DomainException catch (error) {
      if (!mounted) return;
      setState(() {
        _searching = false;
        _selected = null;
        _nearby = const [];
        _suggestions = const [];
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _searching = false;
        _error = 'No se pudo buscar la estación';
      });
    }
  }

  Future<void> _openMaps(StationHit hit) async {
    await _openCoords(hit.latitude, hit.longitude);
  }

  Future<void> _openCoords(double latitude, double longitude) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$latitude,$longitude',
    );
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir el mapa')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Estaciones'),
        actions: [
          IconButton(
            tooltip: session.isDarkTheme ? 'Modo claro' : 'Modo oscuro',
            onPressed: session.themeBusy
                ? null
                : () => session.toggleTheme(),
            icon: Icon(
              session.isDarkTheme ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Text(
            'Suministro o SED',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 4),
          Text(
            'Código de ruta del medidor o código de SED (ej. 2000420). En una SED verás los suministros a menos de 300 m.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _CatalogCountCard(
                  label: 'Suministros',
                  value: _catalog?.supplyCount ?? 0,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _CatalogCountCard(
                  label: 'SEDs',
                  value: _catalog?.sedCount ?? 0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _codeController,
            focusNode: _focusNode,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            maxLength: 12,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _search(),
            decoration: const InputDecoration(
              hintText: '12000003803 o 2000420',
              counterText: '',
              prefixIcon: Icon(Icons.pin_drop_outlined),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _searching ? null : _search,
            child: Text(_searching ? 'Buscando...' : 'Buscar'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (_suggestions.length > 1) ...[
            const SizedBox(height: 16),
            ..._suggestions.map(
              (item) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(
                    '${item.isSed ? 'SED' : 'Suministro'} ${item.code}',
                  ),
                  subtitle: Text(
                    item.isSed ? item.detail : item.coordinatesLabel,
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    _codeController.text = item.code;
                    setState(() => _suggestions = const []);
                    _selectHit(item);
                  },
                ),
              ),
            ),
          ],
          if (_selected != null) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _selected!.isSed ? 'SED' : 'Suministro',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _selected!.code,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.4,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(_selected!.detail),
                    const SizedBox(height: 12),
                    Text('Coordenadas'),
                    Text(_selected!.coordinatesLabel),
                    const SizedBox(height: 16),
                    FilledButton.tonal(
                      onPressed: () => _openMaps(_selected!),
                      child: Text(
                        _selected!.isSed
                            ? 'Abrir SED en Google Maps'
                            : 'Abrir en Google Maps',
                      ),
                    ),
                    if (_selected!.isSed) ...[
                      const SizedBox(height: 16),
                      Text(
                        _loadingNearby
                            ? 'Buscando suministros cercanos…'
                            : '${_nearby.length} suministros a menos de ${sedFeederRadiusMeters.round()} m',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'El KML no une SED y medidor; se infiere por distancia.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      if (_nearby.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ..._nearby.map(
                          (supply) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(supply.routeCode),
                            subtitle: Text(supply.distanceLabel),
                            trailing: const Icon(Icons.map_outlined),
                            onTap: () => _openCoords(
                              supply.latitude,
                              supply.longitude,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CatalogCountCard extends StatelessWidget {
  const _CatalogCountCard({
    required this.label,
    required this.value,
  });

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _formatCount(value),
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _formatCount(int value) {
  final digits = value.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i += 1) {
    final remaining = digits.length - i;
    buffer.write(digits[i]);
    if (remaining > 1 && remaining % 3 == 1) {
      buffer.write(',');
    }
  }
  return buffer.toString();
}
