import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/field_task.dart';
import '../../domain/entities/installation_order.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../../domain/usecases/rank_my_tasks_by_proximity_use_case.dart';
import '../../domain/value_objects/geo_location.dart';
import '../services/device_location_service.dart';
import '../services/image_picker_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'folder_date_detail_page.dart';
import 'installation_order_detail_page.dart';

class TasksPage extends StatefulWidget {
  const TasksPage({super.key, this.onOpenTaskMap});

  final void Function(String taskId)? onOpenTaskMap;

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
  StreamSubscription<List<FieldTask>>? _tasksSub;
  StreamSubscription<List<InstallationOrder>>? _ordersSub;
  List<InstallationOrder> _orders = [];
  int _tasksEpoch = 0;
  final DateTime _openedAt = DateTime.now();
  final Set<String> _seenNoticeKeys = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _listenOrders();
      _load();
    });
  }

  @override
  void dispose() {
    _tasksSub?.cancel();
    _ordersSub?.cancel();
    super.dispose();
  }

  List<RankedFieldTask> get _filtered {
    if (_filter == 'all') return _ranked;
    if (_filter == 'COMPLETADA') {
      return _ranked
          .where((item) => item.routeCompleted || item.task.isCompleted)
          .toList();
    }
    return _ranked
        .where((item) => !item.routeCompleted && item.task.status == _filter)
        .toList();
  }

  void _notifyIfNeeded(String userId, List<FieldTask> tasks) {
    for (final task in tasks) {
      final notice = task.lastNotice;
      if (notice == null || notice.createdById == userId) continue;
      if (!notice.createdAt.isAfter(_openedAt.subtract(const Duration(seconds: 2)))) {
        continue;
      }
      final key = '${task.id}:${notice.createdAt.millisecondsSinceEpoch}';
      if (!_seenNoticeKeys.add(key) || !mounted) continue;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF2E7D32),
          content: Text(notice.message),
        ),
      );
    }
  }

  void _listenOrders() {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;
    _ordersSub?.cancel();
    try {
      _ordersSub = deps.listInstallationOrdersUseCase.watchMine(user).listen(
        (orders) {
          if (!mounted) return;
          setState(() => _orders = orders);
        },
      );
    } catch (_) {
      // Las OTs no bloquean las tareas de rutas.
    }
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
      if (!mounted) return;
      setState(() {
        _location = location;
        _loading = false;
      });
      await _tasksSub?.cancel();
      _tasksSub = deps.listMyTasksUseCase.watch(user).listen((tasks) async {
        final epoch = ++_tasksEpoch;
        _notifyIfNeeded(user.id, tasks);
        final ranked = await deps.rankMyTasksByProximityUseCase.execute(
          tasks: tasks,
          location: location,
        );
        if (!mounted || epoch != _tasksEpoch) return;
        setState(() => _ranked = ranked);
      }, onError: (_) {
        if (!mounted) return;
        setState(() => _error = 'No se pudieron actualizar las tareas');
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

  Future<void> _openNeighborhood(FieldTask task) async {
    widget.onOpenTaskMap?.call(task.id);
    final uri = task.neighborhoodMapsUri;
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir Google Maps')),
      );
    }
  }

  Future<void> _complete(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _busy || _uploading) return;
    setState(() => _busy = true);
    try {
      final updated = await deps.completeMyTaskRouteUseCase.execute(
        user,
        taskId: item.task.id,
        routeCode: item.routeCode,
      );
      if (!mounted) return;
      setState(() {
        _ranked = applyUpdatedTaskToRanked(_ranked, updated);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF2E7D32),
          content: Text(
            updated.isCompleted
                ? 'Tarea completada. Avisamos a los demás técnicos.'
                : 'Suministro ${item.routeCode} completado. Avisamos al equipo.',
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
        const SnackBar(
          content: Text('No se pudo completar este suministro. Inténtalo de nuevo.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _claim(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _busy || _uploading) return;
    setState(() => _busy = true);
    try {
      final updated = await deps.claimMyTaskRouteUseCase.execute(
        user,
        taskId: item.task.id,
        routeCode: item.routeCode,
      );
      if (!mounted) return;
      setState(() {
        _ranked = applyUpdatedTaskToRanked(_ranked, updated);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF1565C0),
          content: Text(
            'Tomaste el suministro ${item.routeCode}. Los demás ya lo ven ocupado.',
          ),
        ),
      );
      widget.onOpenTaskMap?.call(updated.id);
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _release(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _busy || _uploading) return;
    setState(() => _busy = true);
    try {
      final updated = await deps.releaseMyTaskRouteUseCase.execute(
        user,
        taskId: item.task.id,
        routeCode: item.routeCode,
      );
      if (!mounted) return;
      setState(() {
        _ranked = applyUpdatedTaskToRanked(_ranked, updated);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Soltaste el suministro ${item.routeCode}')),
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

  Future<void> _saveGps(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _busy || _uploading) return;
    setState(() => _busy = true);
    try {
      final location = await _locationService.getCurrentLocation(
        purpose: 'guardar la ubicación de este suministro',
      );
      await deps.saveTaskRouteLocationUseCase.execute(
        user,
        taskId: item.task.id,
        routeCode: item.routeCode,
        latitude: location.latitude,
        longitude: location.longitude,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Ubicación guardada en el suministro ${item.routeCode}',
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
    List<ImageFilePayload> files, {
    String note = '',
  }) async {
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
        routeCode: item.routeCode,
        files: files,
        note: note,
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
      final updated = await deps.markMyTaskRoutePhotosUseCase.execute(
        user,
        taskId: item.task.id,
        routeCode: item.routeCode,
      );
      if (!mounted) return;
      setState(() {
        _ranked = applyUpdatedTaskToRanked(_ranked, updated);
      });
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
    final userId = context.read<SessionController>().user?.id ?? '';
    if (!item.isClaimedBy(userId)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            item.isClaimed
                ? 'Este punto ya lo tomó ${item.claimedByName}'
                : 'Primero agarrar este punto para mandar fotos',
          ),
        ),
      );
      return;
    }
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

    final note = await askOptionalPhotoNote(context);
    if (note == null || !mounted) return;

    await showPhotoSourceSheet(
      context: context,
      onCamera: () async {
        final photo = await _picker.takePhoto();
        if (photo != null) await _uploadPhotos(item, [photo], note: note);
      },
      onGallery: () async {
        final photos = await _picker.pickFromGallery(multiple: true);
        await _uploadPhotos(item, photos, note: note);
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
    final userId = context.watch<SessionController>().user?.id ?? '';
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
            if (_orders.isNotEmpty) ...[
              const Text(
                'Instalaciones nuevas',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
              ),
              const SizedBox(height: 8),
              ..._orders.map(
                (order) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: order.isProgrammed
                          ? const Color(0xFFE8F5E9)
                          : const Color(0xFFECEFF3),
                      child: Icon(
                        order.isProgrammed
                            ? Icons.play_arrow_rounded
                            : Icons.close_rounded,
                        color: order.isProgrammed
                            ? const Color(0xFF2E7D32)
                            : const Color(0xFF607080),
                      ),
                    ),
                    title: Text(
                      order.orderNumber,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    subtitle: Text(
                      [
                        'SI/NO: ${order.registeredFlagLabel}',
                        order.applicantName,
                        if (order.scheduledDateLabel.isNotEmpty)
                          order.scheduledDateLabel,
                      ].where((item) => item.trim().isNotEmpty).join(' · '),
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              InstallationOrderDetailPage(order: order),
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
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
                    item.routeCode.trim().isNotEmpty;
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  color: item.isRecommended
                      ? AppTheme.statusBackground(context, 'done')
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
                                color: AppTheme.statusBackground(
                                  context,
                                  item.isRecommended
                                      ? 'done'
                                      : task.status,
                                ),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                item.isRecommended
                                    ? 'Más cerca'
                                    : task.statusLabel,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.statusForeground(
                                    context,
                                    item.isRecommended
                                        ? 'done'
                                        : task.status,
                                  ),
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
                            if (task.isJointAssignment)
                              Chip(
                                avatar: const Icon(Icons.groups_rounded, size: 16),
                                label: Text(
                                  task.assignToAllTechnicians
                                      ? 'En conjunto · Todos'
                                      : 'En conjunto · ${task.assignedTechnicianIds.length} técnicos',
                                ),
                                visualDensity: VisualDensity.compact,
                              )
                            else if (task.assigneesLabel.isNotEmpty)
                              Chip(
                                label: Text(task.assigneesLabel),
                                visualDensity: VisualDensity.compact,
                              ),
                            if (task.areaName.isNotEmpty)
                              Chip(
                                label: Text(task.areaName),
                                visualDensity: VisualDensity.compact,
                              ),
                            if (item.routeCode.isNotEmpty)
                              Chip(
                                label: Text('Suministro ${item.routeCode}'),
                                visualDensity: VisualDensity.compact,
                              ),
                            if (task.hasNeighborhoodRoute)
                              Chip(
                                label: Text(
                                  'Vecinal: ${task.neighborhoodRouteName}',
                                ),
                                visualDensity: VisualDensity.compact,
                              ),
                            if (task.normalizedRoutes.length > 1)
                              Chip(
                                label: Text(task.routesLabel),
                                visualDensity: VisualDensity.compact,
                              ),
                          ],
                        ),
                        if (!item.routeCompleted && item.isClaimed) ...[
                          const SizedBox(height: 6),
                          Text(
                            item.isClaimedBy(userId)
                                ? 'Lo tomaste tú. Manda fotos y luego completa.'
                                : 'Tomado por ${item.claimedByName}',
                            style: TextStyle(
                              color: item.isClaimedBy(userId)
                                  ? const Color(0xFF1565C0)
                                  : const Color(0xFFEF6C00),
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: !canSendPhotos ||
                                    actionsBlocked ||
                                    !item.isClaimedBy(userId)
                                ? null
                                : () => _addPhotos(item),
                            icon: const Icon(Icons.photo_camera_rounded),
                            label: Text(
                              !canSendPhotos
                                  ? 'Sin actividad asignada'
                                  : item.photosUploaded
                                      ? 'Fotos listas · mandar más'
                                      : 'Mandar fotos (obligatorio)',
                            ),
                          ),
                        ),
                        if (!item.hasMapPoint && !item.routeCompleted) ...[
                          const SizedBox(height: 8),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: actionsBlocked
                                  ? null
                                  : () => _saveGps(item),
                              icon: const Icon(Icons.gps_fixed_rounded),
                              label: const Text('Activar GPS y guardar punto'),
                            ),
                          ),
                        ],
                        if (!item.routeCompleted) ...[
                          const SizedBox(height: 8),
                          if (!item.isClaimed)
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                onPressed: actionsBlocked
                                    ? null
                                    : () => _claim(item),
                                icon: const Icon(Icons.front_hand_rounded),
                                label: const Text('Agarrar este punto'),
                              ),
                            )
                          else if (item.isClaimedBy(userId))
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: actionsBlocked
                                        ? null
                                        : () => _release(item),
                                    child: const Text('Soltar'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton(
                                    onPressed: actionsBlocked
                                        ? null
                                        : () => _complete(item),
                                    child: Text(
                                      item.photosUploaded
                                          ? 'Completar'
                                          : 'Faltan fotos',
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          if (task.hasNeighborhoodRoute) ...[
                            const SizedBox(height: 8),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                onPressed: actionsBlocked
                                    ? null
                                    : () => _openNeighborhood(task),
                                icon: const Icon(Icons.alt_route_rounded),
                                label: const Text('Ruta vecinal'),
                              ),
                            ),
                          ],
                          if (task.isInProgress) ...[
                            const SizedBox(height: 8),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                onPressed: actionsBlocked
                                    ? null
                                    : () => widget.onOpenTaskMap
                                        ?.call(task.id),
                                icon: const Icon(Icons.map_rounded),
                                label: const Text('Ver mapa'),
                              ),
                            ),
                          ],
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
