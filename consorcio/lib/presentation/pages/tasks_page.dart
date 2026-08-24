import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../../domain/usecases/rank_my_tasks_by_proximity_use_case.dart';
import '../../domain/value_objects/geo_location.dart';
import '../services/device_location_service.dart';
import '../services/image_picker_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'folder_date_detail_page.dart';

class TasksPage extends StatefulWidget {
  const TasksPage({super.key});

  @override
  State<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends State<TasksPage> {
  final _locationService = DeviceLocationService();
  final _picker = ImagePickerService();

  List<RankedFieldTask> _ranked = [];
  GeoLocation? _location;
  bool _loading = true;
  bool _busy = false;
  bool _uploading = false;
  String _uploadStatus = '';
  bool _gpsRequired = false;
  String? _error;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  List<RankedFieldTask> get _filtered {
    if (_filter == 'all') return _ranked;
    return _ranked.where((item) => item.task.status == _filter).toList();
  }

  Future<void> _load() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    setState(() {
      _loading = true;
      _error = null;
      _gpsRequired = false;
    });

    try {
      final location = await _locationService.getCurrentLocation(
        purpose: 'ordenar tus tareas por el suministro más cercano',
      );
      final tasks = await deps.listMyTasksUseCase.execute(user);
      final ranked = await deps.rankMyTasksByProximityUseCase.execute(
        tasks: tasks,
        location: location,
      );
      if (!mounted) return;
      setState(() {
        _location = location;
        _ranked = ranked;
        _loading = false;
      });
    } on DomainException catch (error) {
      if (!mounted) return;
      final needsGps = error.message.toLowerCase().contains('gps') ||
          error.message.toLowerCase().contains('ubicación') ||
          error.message.toLowerCase().contains('permiso');
      setState(() {
        _error = error.message;
        _gpsRequired = needsGps;
        _loading = false;
        _ranked = [];
        _location = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudieron cargar tus tareas';
        _gpsRequired = false;
        _loading = false;
      });
    }
  }

  Future<void> _start(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _busy || _uploading) return;

    final recommended = _ranked.where((entry) => entry.isRecommended).toList();
    if (recommended.isNotEmpty &&
        recommended.first.task.id != item.task.id &&
        !item.task.isInProgress) {
      final nearest = recommended.first;
      final goAnyway = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Hay una más cerca'),
          content: Text(
            'Te recomendamos empezar por "${nearest.task.title}" '
            '(${formatTaskDistance(nearest.distanceMeters)}). '
            '¿Quieres empezar esta igual?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Empezar igual'),
            ),
          ],
        ),
      );
      if (goAnyway != true || !mounted) return;
    }

    setState(() => _busy = true);
    try {
      final updated = await deps.startMyTaskUseCase.execute(user, item.task.id);
      if (!mounted) return;
      setState(() {
        _ranked = _ranked
            .map(
              (entry) => entry.task.id == updated.id
                  ? RankedFieldTask(
                      task: updated,
                      distanceMeters: entry.distanceMeters,
                      hasSupplyLocation: entry.hasSupplyLocation,
                      isRecommended: entry.isRecommended,
                      latitude: entry.latitude,
                      longitude: entry.longitude,
                    )
                  : entry,
            )
            .toList();
      });
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _complete(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _busy || _uploading) return;
    setState(() => _busy = true);
    try {
      final updated =
          await deps.completeMyTaskUseCase.execute(user, item.task.id);
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            updated.isCompleted
                ? 'Tarea completada. Revisamos el siguiente más cercano.'
                : 'Tarea actualizada',
          ),
        ),
      );
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _uploadPhotos(
    RankedFieldTask item,
    List<ImageFilePayload> files,
  ) async {
    if (files.isEmpty) return;
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _uploading) return;

    setState(() {
      _uploading = true;
      _uploadStatus = 'Preparando...';
    });

    try {
      final result = await deps.uploadTaskPhotosUseCase.execute(
        user,
        task: item.task,
        files: files,
        location: _location,
        onStatus: (status) {
          if (!mounted) return;
          setState(() => _uploadStatus = status);
        },
        onProgress: (current, total) {
          if (!mounted) return;
          setState(() => _uploadStatus = 'Subiendo $current de $total...');
        },
      );
      if (!mounted) return;
      final count = result.images.length;
      final areaLabel =
          item.task.areaName.trim().isEmpty ? 'la actividad' : item.task.areaName;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            count == 1
                ? 'Foto enviada a $areaLabel · hoy'
                : '$count fotos enviadas a $areaLabel · hoy',
          ),
          action: SnackBarAction(
            label: 'Ver',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => FolderDateDetailPage(
                    folderId: result.folder.id,
                    dateId: result.folderDate.id,
                  ),
                ),
              );
            },
          ),
        ),
      );
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudieron subir las fotos')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _uploading = false;
          _uploadStatus = '';
        });
      }
    }
  }

  Future<void> _addPhotos(RankedFieldTask item) async {
    if (_busy || _uploading) return;
    if (item.task.areaId.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Esta tarea no tiene actividad. Pide al admin que la asigne.',
          ),
        ),
      );
      return;
    }

    await showPhotoSourceSheet(
      context: context,
      onCamera: () async {
        final photo = await _picker.takePhoto();
        if (photo != null) await _uploadPhotos(item, [photo]);
      },
      onGallery: () async {
        final photos = await _picker.pickFromGallery(multiple: true);
        await _uploadPhotos(item, photos);
      },
    );
  }

  String _formatDue(DateTime? date) {
    if (date == null) return 'Sin fecha límite';
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    return 'Límite $day/$month/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final recommendedList =
        _ranked.where((item) => item.isRecommended).toList();
    final recommended =
        recommendedList.isEmpty ? null : recommendedList.first;
    final actionsBlocked = _busy || _uploading;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis tareas'),
        actions: [
          IconButton(
            tooltip: 'Actualizar ubicación',
            onPressed: _loading || _uploading ? null : _load,
            icon: const Icon(Icons.my_location_rounded),
          ),
        ],
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _uploading ? () async {} : _load,
            child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
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
                  const Text(
                    'Ruta sugerida',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _location == null
                        ? 'Activa el GPS para ordenar por el suministro más cercano.'
                        : 'Empezamos por el suministro más cerca de ti.',
                    style: const TextStyle(color: Colors.white70),
                  ),
                  if (recommended != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      'Recomendada: ${recommended.task.title} · '
                      '${formatTaskDistance(recommended.distanceMeters)}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (!_gpsRequired && !_loading && _error == null)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _FilterChip(
                    label: 'Todas',
                    selected: _filter == 'all',
                    onTap: () => setState(() => _filter = 'all'),
                  ),
                  _FilterChip(
                    label: 'Pendientes',
                    selected: _filter == 'PENDIENTE',
                    onTap: () => setState(() => _filter = 'PENDIENTE'),
                  ),
                  _FilterChip(
                    label: 'En progreso',
                    selected: _filter == 'EN_PROGRESO',
                    onTap: () => setState(() => _filter = 'EN_PROGRESO'),
                  ),
                  _FilterChip(
                    label: 'Hechas',
                    selected: _filter == 'COMPLETADA',
                    onTap: () => setState(() => _filter = 'COMPLETADA'),
                  ),
                ],
              ),
            const SizedBox(height: 14),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_gpsRequired)
              _GpsGate(
                message: _error ?? 'Activa el GPS para ver tus tareas.',
                onRetry: _load,
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Column(
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Reintentar'),
                    ),
                  ],
                ),
              )
            else if (filtered.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text(
                  'No hay tareas en este filtro.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              ...filtered.map((item) {
                final task = item.task;
                final canSendPhotos = task.areaId.trim().isNotEmpty &&
                    task.routeCode.trim().isNotEmpty;
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  color: item.isRecommended
                      ? const Color(0xFFE8F5E9)
                      : null,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: task.isCompleted
                                    ? const Color(0xFFE8F5E9)
                                    : task.isInProgress
                                        ? const Color(0xFFE3F2FD)
                                        : const Color(0xFFFFF8E1),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                item.isRecommended
                                    ? 'Más cerca'
                                    : task.statusLabel,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: item.isRecommended
                                      ? const Color(0xFF2E7D32)
                                      : task.isCompleted
                                          ? const Color(0xFF2E7D32)
                                          : task.isInProgress
                                              ? const Color(0xFF1565C0)
                                              : const Color(0xFFB45309),
                                ),
                              ),
                            ),
                            const Spacer(),
                            Text(
                              formatTaskDistance(item.distanceMeters),
                              style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          task.title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (task.description.trim().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(task.description),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          _formatDue(task.dueDate),
                          style: TextStyle(
                            color: Theme.of(context)
                                .colorScheme
                                .onSurfaceVariant,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if (task.areaName.isNotEmpty)
                              Chip(
                                label: Text(task.areaName),
                                visualDensity: VisualDensity.compact,
                              ),
                            if (task.routeCode.isNotEmpty)
                              Chip(
                                label: Text('Suministro ${task.routeCode}'),
                                visualDensity: VisualDensity.compact,
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: !canSendPhotos || actionsBlocked
                                ? null
                                : () => _addPhotos(item),
                            icon: const Icon(Icons.photo_camera_rounded),
                            label: Text(
                              canSendPhotos
                                  ? 'Mandar fotos a la actividad'
                                  : 'Sin actividad asignada',
                            ),
                          ),
                        ),
                        if (!task.isCompleted) ...[
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              if (task.isPending)
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: actionsBlocked
                                        ? null
                                        : () => _start(item),
                                    child: Text(
                                      item.isRecommended
                                          ? 'Empezar esta'
                                          : 'Empezar',
                                    ),
                                  ),
                                ),
                              if (task.isPending) const SizedBox(width: 8),
                              Expanded(
                                child: FilledButton(
                                  onPressed: actionsBlocked
                                      ? null
                                      : () => _complete(item),
                                  child: const Text('Completar'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
          ),
          if (_uploading)
            Positioned.fill(
              child: ColoredBox(
                color: Colors.black45,
                child: Center(
                  child: Card(
                    margin: const EdgeInsets.all(32),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const CircularProgressIndicator(),
                          const SizedBox(height: 14),
                          Text(
                            _uploadStatus.isEmpty
                                ? 'Subiendo fotos...'
                                : _uploadStatus,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _GpsGate extends StatelessWidget {
  const _GpsGate({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: Column(
        children: [
          const Icon(Icons.location_off_rounded, size: 48),
          const SizedBox(height: 12),
          const Text(
            'GPS obligatorio',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          const Text(
            'Sin ubicación no podemos recomendarte el suministro más cercano.',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.my_location_rounded),
            label: const Text('Activar y continuar'),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }
}
