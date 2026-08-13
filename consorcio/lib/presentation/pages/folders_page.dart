import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/image_folder.dart';
import '../../domain/errors/domain_exception.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'create_edit_folder_page.dart';
import 'folder_detail_page.dart';

class FoldersPage extends StatefulWidget {
  const FoldersPage({super.key});

  @override
  State<FoldersPage> createState() => _FoldersPageState();
}

class _FoldersPageState extends State<FoldersPage> {
  final _searchController = TextEditingController();
  List<ImageFolder> _folders = [];
  bool _loading = true;
  String? _error;
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<ImageFolder> get _filteredFolders {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _folders;

    return _folders.where((folder) {
      final name = folder.name.toLowerCase();
      final description = folder.description.toLowerCase();
      final created = _searchableDate(folder.createdAt);
      final updated = _searchableDate(folder.updatedAt);

      return name.contains(query) ||
          description.contains(query) ||
          created.contains(query) ||
          updated.contains(query);
    }).toList();
  }

  String _searchableDate(DateTime date) {
    final local = date.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final year = local.year.toString();
    // Varias formas: 13/08/2026, 13-08-2026, 2026-08-13, 13082026
    return [
      '$day/$month/$year',
      '$day-$month-$year',
      '$year-$month-$day',
      '$day$month$year',
      '$day/$month',
      year,
    ].join(' ');
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
      final folders = await deps.listMyFoldersUseCase.execute(user);
      if (!mounted) return;
      setState(() {
        _folders = folders;
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

  Future<void> _openCreate() async {
    final result = await Navigator.of(context).push<Object?>(
      MaterialPageRoute(builder: (_) => const CreateEditFolderPage()),
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
        title: const Text('Mis carpetas'),
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
                      'Crea carpetas y sube fotos del campo.',
                      style: TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 14),
            TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              onChanged: (value) => setState(() => _query = value),
              decoration: InputDecoration(
                hintText: 'Buscar por nombre, fecha o descripción',
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
            if (!_loading && _error == null && _folders.isNotEmpty) ...[
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
            else if (_folders.isEmpty)
              _EmptyState(
                icon: Icons.folder_open_rounded,
                title: 'Aún no tienes carpetas',
                subtitle:
                    'Toca “Nueva carpeta”, ponle nombre y sube fotos del trabajo.',
                actionLabel: 'Crear carpeta',
                onAction: _openCreate,
              )
            else if (filtered.isEmpty)
              _EmptyState(
                icon: Icons.search_off_rounded,
                title: 'Sin resultados',
                subtitle:
                    'No hay carpetas que coincidan con “${_query.trim()}”.',
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
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                FolderDetailPage(folderId: folder.id),
                          ),
                        );
                        await _load();
                      },
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
                                    folder.name,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    folder.description.isEmpty
                                        ? 'Sin descripción'
                                        : folder.description,
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
                                    '${folder.imageCount} foto(s)',
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
