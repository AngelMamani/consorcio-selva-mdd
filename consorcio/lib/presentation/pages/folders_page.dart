import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/image_folder.dart';
import '../../domain/entities/supply.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/services/supply_folder_service.dart';
import '../../domain/services/supply_search_service.dart';
import '../../domain/usecases/search_supplies_use_case.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'create_edit_folder_page.dart';
import 'folder_detail_page.dart';

class FoldersPage extends StatefulWidget {
  const FoldersPage({
    super.key,
    required this.areaId,
    required this.areaName,
  });

  final String areaId;
  final String areaName;

  @override
  State<FoldersPage> createState() => _FoldersPageState();
}

class _FoldersPageState extends State<FoldersPage> {
  final _searchController = TextEditingController();
  List<ImageFolder> _folders = [];
  List<Supply> _catalog = [];
  int _catalogCount = 0;
  bool _loading = true;
  String? _error;
  String _query = '';
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    setState(() => _query = _searchController.text);
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 80), _loadCatalog);
  }

  List<ImageFolder> get _displayFolders {
    final byRoute = <String, ImageFolder>{};
    for (final folder in _folders) {
      final code = folder.routeCode;
      if (code != null && code.isNotEmpty) {
        byRoute[code] = folder;
      }
    }

    final fromCatalog = _catalog
        .map(
          (supply) => folderFromSupply(
            areaId: widget.areaId,
            areaName: widget.areaName,
            supply: supply,
            existing: byRoute[supply.routeCode],
          ),
        )
        .toList();
    final used = fromCatalog.map((folder) => folder.routeCode).toSet();
    final extra = _folders.where(
      (folder) => folder.isSupplyFolder && !used.contains(folder.routeCode),
    );
    final custom = _folders.where((folder) => !folder.isSupplyFolder);
    return [...extra, ...fromCatalog, ...custom];
  }

  List<ImageFolder> get _filteredFolders {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _displayFolders;
    final digits = normalizeRouteCode(_query);

    final matched = _displayFolders.where((folder) {
      final name = folder.name.toLowerCase();
      final description = folder.description.toLowerCase();
      final code = folder.routeCode ?? folder.name;
      return name.contains(query) ||
          description.contains(query) ||
          supplyCodeMatchesQuery(code, digits);
    }).toList();

    if (digits.length >= supplySearchMinDigits) {
      matched.sort((left, right) {
        final leftScore = scoreSupplyCode(left.routeCode ?? left.name, digits);
        final rightScore = scoreSupplyCode(right.routeCode ?? right.name, digits);
        if (leftScore != rightScore) return leftScore.compareTo(rightScore);
        return (left.routeCode ?? left.name)
            .compareTo(right.routeCode ?? right.name);
      });
    }
    return matched;
  }

  Future<void> _load() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final folders = await deps.listMyFoldersUseCase.execute(
        user,
        areaId: widget.areaId,
      );
      final status = await deps.getSupplyCatalogStatusUseCase.execute(user);
      final prefix = normalizeRouteCode(_query);
      final supplies = prefix.length < supplySearchMinDigits
          ? const <Supply>[]
          : await deps.listSupplyCatalogUseCase.execute(user, prefix);
      if (!mounted) return;
      setState(() {
        _folders = folders;
        _catalogCount = status?.supplyCount ?? 0;
        _catalog = supplies;
        _loading = false;
      });
    } on DomainException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudieron cargar tus carpetas';
        _loading = false;
      });
    }
  }

  Future<void> _loadCatalog() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || !mounted) return;

    final prefix = normalizeRouteCode(_query);
    if (prefix.length < supplySearchMinDigits) {
      setState(() => _catalog = []);
      return;
    }

    try {
      final supplies = await deps.listSupplyCatalogUseCase.execute(user, prefix);
      if (!mounted) return;
      setState(() => _catalog = supplies);
    } catch (_) {
      if (!mounted) return;
      setState(() => _catalog = []);
    }
  }

  Future<void> _openFolder(ImageFolder folder) async {
    final code = normalizeRouteCode(folder.routeCode ?? folder.name);
    final folderId = isRouteCode(code) || isVirtualSupplyFolderId(folder.id)
        ? supplyFolderDocId(widget.areaId, code)
        : folder.id;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FolderDetailPage(
          folderId: folderId,
          areaName: widget.areaName,
        ),
      ),
    );
    await _load();
  }

  Future<void> _openCreate() async {
    final result = await Navigator.of(context).push<Object?>(
      MaterialPageRoute(
        builder: (_) => CreateEditFolderPage(
          areaId: widget.areaId,
          areaName: widget.areaName,
        ),
      ),
    );
    if (result == null) return;
    await _load();
    if (!mounted) return;
    if (result is String) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => FolderDetailPage(folderId: result),
        ),
      );
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final user = session.user;
    final filtered = _filteredFolders;
    final hasQuery = _query.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.areaName),
        actions: [
          IconButton(
            tooltip: session.isDarkTheme ? 'Modo claro' : 'Modo oscuro',
            onPressed: session.themeBusy
                ? null
                : () async {
                    final ok = await session.toggleTheme();
                    if (!ok &&
                        context.mounted &&
                        session.errorMessage != null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(session.errorMessage!)),
                      );
                    }
                  },
            icon: Icon(
              session.isDarkTheme
                  ? Icons.light_mode_rounded
                  : Icons.dark_mode_rounded,
            ),
          ),
          IconButton(
            tooltip: 'Cerrar sesión',
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Cerrar sesión'),
                  content: const Text('¿Salir de la app de técnicos?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Cancelar'),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('Salir'),
                    ),
                  ],
                ),
              );
              if (confirm == true && context.mounted) {
                await context.read<SessionController>().logout();
              }
            },
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        icon: const Icon(Icons.create_new_folder_rounded),
        label: const Text('Nueva carpeta'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
          children: [
            if (user != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.brandBlue, AppTheme.brandGreen],
                  ),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hola, ${user.displayName.split(' ').first}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Busca el código completo, sin el 12 o por los últimos dígitos.',
                      style: TextStyle(color: Colors.white70),
                    ),
                    if (_catalogCount > 0) ...[
                      const SizedBox(height: 8),
                      Text(
                        '$_catalogCount suministros',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 14),
            TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              keyboardType: TextInputType.number,
              autofocus: true,
              onSubmitted: (_) {
                if (_filteredFolders.isNotEmpty) {
                  _openFolder(_filteredFolders.first);
                }
              },
              decoration: InputDecoration(
                hintText: 'Código, últimos dígitos o sin el 12',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: hasQuery
                    ? IconButton(
                        tooltip: 'Limpiar',
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                        icon: const Icon(Icons.close_rounded),
                      )
                    : null,
              ),
            ),
            if (!_loading && _error == null && _displayFolders.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                hasQuery
                    ? '${filtered.length} resultado${filtered.length == 1 ? '' : 's'}'
                    : '${_folders.length} carpeta${_folders.length == 1 ? '' : 's'}',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              _EmptyState(
                icon: Icons.error_outline_rounded,
                title: 'Algo salió mal',
                subtitle: _error!,
                actionLabel: 'Reintentar',
                onAction: _load,
              )
            else if (_displayFolders.isEmpty && _catalogCount == 0)
              _EmptyState(
                icon: Icons.folder_open_rounded,
                title: 'Catálogo pendiente',
                subtitle:
                    'Aún no hay suministros importados. Cuando existan, estarán fijos en cada área.',
                actionLabel: 'Reintentar',
                onAction: _load,
              )
            else if (filtered.isEmpty)
              _EmptyState(
                icon: Icons.search_off_rounded,
                title: 'Sin resultados',
                subtitle:
                    'Código completo, últimos 5 a 8 dígitos o sin el 12 inicial.',
                actionLabel: 'Limpiar búsqueda',
                onAction: () {
                  _searchController.clear();
                  setState(() => _query = '');
                },
              )
            else
              ...filtered.map(
                (folder) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () => _openFolder(folder),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Container(
                              width: 52,
                              height: 52,
                              decoration: BoxDecoration(
                                color: Theme.of(context).brightness ==
                                        Brightness.dark
                                    ? const Color(0xFF243044)
                                    : const Color(0xFFE8F1FA),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Icon(
                                Icons.folder_rounded,
                                color: AppTheme.brandBlue,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    folder.isSupplyFolder
                                        ? formatRouteCode(
                                            folder.routeCode ?? folder.name,
                                          )
                                        : folder.name,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    folder.isSupplyFolder
                                        ? 'Suministro del catálogo'
                                        : (folder.description.isEmpty
                                            ? 'Sin descripción'
                                            : folder.description),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${folder.imageCount} foto(s) · ${folder.assigneesLabel}',
                                    style: const TextStyle(
                                      color: AppTheme.brandGreen,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Creada ${_formatDateTime(folder.createdAt)}',
                                    style: TextStyle(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (_wasModified(folder))
                                    Text(
                                      'Modificada ${_formatDateTime(folder.updatedAt)}',
                                      style: const TextStyle(
                                        color: Color(0xFF00897B),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatDateTime(DateTime date) {
    final local = date.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final year = local.year;
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$day/$month/$year $hour:$minute';
  }

  bool _wasModified(ImageFolder folder) {
    return folder.updatedAt.difference(folder.createdAt).abs().inMinutes >= 1;
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: Column(
        children: [
          Icon(
            icon,
            size: 56,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 18),
          FilledButton(onPressed: onAction, child: Text(actionLabel)),
        ],
      ),
    );
  }
}
