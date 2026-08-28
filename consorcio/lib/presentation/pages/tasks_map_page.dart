import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/field_task.dart';
import '../../domain/entities/supply.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../../domain/usecases/rank_my_tasks_by_proximity_use_case.dart';
import '../../domain/usecases/search_supplies_use_case.dart';
import '../../domain/value_objects/geo_location.dart';
import '../services/device_location_service.dart';
import '../services/image_picker_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'folder_date_detail_page.dart';

class TasksMapPage extends StatefulWidget {
  const TasksMapPage({
    super.key,
    this.focusedTaskId,
    this.onClearTaskFocus,
  });

  final String? focusedTaskId;
  final VoidCallback? onClearTaskFocus;

  @override
  State<TasksMapPage> createState() => _TasksMapPageState();
}

class _TasksMapPageState extends State<TasksMapPage> {
  final _locationService = DeviceLocationService();
  final _picker = ImagePickerService();
  final _mapController = MapController();
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();

  List<RankedFieldTask> _ranked = [];
  GeoLocation? _location;
  RankedFieldTask? _selected;
  bool _loading = true;
  bool _uploading = false;
  bool _panelOpen = true;
  String _uploadStatus = '';
  bool _gpsRequired = false;
  String? _error;
  StreamSubscription<List<FieldTask>>? _tasksSub;
  int _tasksEpoch = 0;
  final DateTime _openedAt = DateTime.now();
  final Set<String> _seenNoticeKeys = {};
  Timer? _suggestTimer;
  bool _searching = false;
  String? _searchError;
  List<StationHit> _suggestions = const [];
  StationHit? _searchHit;
  List<NearbySupply> _nearby = const [];
  int _searchEpoch = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tasksSub?.cancel();
    _suggestTimer?.cancel();
    _searchController.dispose();
    _searchFocus.dispose();
    _mapController.dispose();
    super.dispose();
  }

  List<RankedFieldTask> get _visibleRanked {
    final focusedId = widget.focusedTaskId?.trim();
    if (focusedId == null || focusedId.isEmpty) return _ranked;
    return _ranked.where((item) => item.task.id == focusedId).toList();
  }

  List<RankedFieldTask> get _mapPoints =>
      _visibleRanked.where((item) => item.hasMapPoint).toList();

  List<RankedFieldTask> get _missingGps => _visibleRanked
      .where((item) => !item.routeCompleted && !item.hasMapPoint)
      .toList();

  FieldTask? get _focusedTask {
    final focusedId = widget.focusedTaskId?.trim();
    if (focusedId == null || focusedId.isEmpty) return null;
    for (final item in _ranked) {
      if (item.task.id == focusedId) return item.task;
    }
    return null;
  }

  List<FieldTask> get _neighborhoodTasks {
    final byId = <String, FieldTask>{};
    for (final item in _visibleRanked) {
      if (item.task.hasNeighborhoodMapPoint) {
        byId[item.task.id] = item.task;
      }
    }
    return byId.values.toList();
  }

  @override
  void didUpdateWidget(covariant TasksMapPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusedTaskId == widget.focusedTaskId) return;
    final location = _location;
    if (location == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final points = _mapPoints;
      setState(() {
        _selected = points.isEmpty ? null : points.first;
        _panelOpen = true;
      });
      _fitMap(location, points);
    });
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
        purpose: 'mostrar tus tareas en el mapa',
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
        final points = ranked
            .where((item) {
              if (!item.hasMapPoint) return false;
              final focusedId = widget.focusedTaskId?.trim();
              if (focusedId == null || focusedId.isEmpty) return true;
              return item.task.id == focusedId;
            })
            .toList();
        RankedFieldTask? selected;
        if (_selected != null) {
          for (final item in points) {
            if (item.key == _selected!.key) {
              selected = item;
              break;
            }
          }
        }
        selected ??= points.isEmpty ? null : points.first;
        setState(() {
          _ranked = ranked;
          _selected = selected;
        });
        if (_searchHit == null) {
          _fitMap(location, points);
        }
      }, onError: (_) {
        if (!mounted) return;
        setState(() => _error = 'No se pudo actualizar el mapa de tareas');
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
        _selected = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudo cargar el mapa de tareas';
        _gpsRequired = false;
        _loading = false;
      });
    }
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

  void _fitMap(GeoLocation location, List<RankedFieldTask> open) {
    final points = <LatLng>[
      LatLng(location.latitude, location.longitude),
      ...open.map((item) => LatLng(item.latitude!, item.longitude!)),
      ..._neighborhoodTasks.map(
        (task) => LatLng(task.neighborhoodLatitude!, task.neighborhoodLongitude!),
      ),
    ];
    if (points.length == 1) {
      _mapController.move(points.first, 16);
      return;
    }
    final bounds = LatLngBounds.fromPoints(points);
    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.fromLTRB(48, 48, 48, 220),
        maxZoom: 17,
      ),
    );
  }

  void _selectTask(RankedFieldTask item) {
    if (!item.hasMapPoint) return;
    setState(() {
      _selected = item;
      _panelOpen = true;
      _searchHit = null;
      _nearby = const [];
      _suggestions = const [];
    });
    _mapController.move(
      LatLng(item.latitude!, item.longitude!),
      17,
    );
  }

  RankedFieldTask? _taskForCode(String code) {
    for (final item in _ranked) {
      if (item.routeCode == code && item.hasMapPoint) return item;
    }
    return null;
  }

  String _shortCode(String code) {
    final trimmed = code.trim();
    if (trimmed.length <= 6) return trimmed.isEmpty ? '•' : trimmed;
    return trimmed.substring(trimmed.length - 6);
  }

  void _onSearchChanged(String value) {
    _suggestTimer?.cancel();
    final code = normalizeRouteCode(value);
    if (code.length < 4) {
      setState(() {
        _suggestions = const [];
        _searchError = null;
      });
      return;
    }
    _suggestTimer = Timer(const Duration(milliseconds: 250), () {
      _suggest(code);
    });
  }

  Future<void> _suggest(String code) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || !mounted) return;
    final epoch = ++_searchEpoch;
    try {
      final found = await deps.searchStationsUseCase.execute(user, code);
      if (!mounted || epoch != _searchEpoch) return;
      setState(() {
        _suggestions = found;
        _searchError = found.isEmpty ? 'No hay coincidencias' : null;
      });
    } catch (_) {
      if (!mounted || epoch != _searchEpoch) return;
      setState(() => _suggestions = const []);
    }
  }

  Future<void> _searchRoute({String? raw}) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _searching) return;

    final code = normalizeRouteCode(raw ?? _searchController.text);
    if (code.length < 4) {
      setState(() {
        _searchError = 'Escribe al menos 4 dígitos del código';
        _suggestions = const [];
      });
      return;
    }

    _suggestTimer?.cancel();
    setState(() {
      _searching = true;
      _searchError = null;
      _suggestions = const [];
    });

    try {
      StationHit? hit;
      if (code.length >= 7) {
        try {
          hit = await deps.getStationByCodeUseCase.execute(user, code);
        } on DomainException {
          hit = null;
        }
      }
      if (hit == null) {
        final found = await deps.searchStationsUseCase.execute(user, code);
        if (!mounted) return;
        if (found.length > 1) {
          setState(() {
            _searching = false;
            _suggestions = found;
            _searchError = null;
          });
          return;
        }
        if (found.isEmpty) {
          setState(() {
            _searching = false;
            _searchError = 'No hay suministro ni SED con ese código';
          });
          return;
        }
        hit = found.first;
      }
      if (!mounted) return;
      await _selectSearchHit(hit);
    } on DomainException catch (error) {
      if (!mounted) return;
      setState(() {
        _searching = false;
        _searchError = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _searching = false;
        _searchError = 'No se pudo buscar la ruta';
      });
    }
  }

  Future<void> _selectSearchHit(StationHit hit) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    final matching = _taskForCode(hit.code);

    _searchFocus.unfocus();
    _searchController.text = hit.code;
    setState(() {
      _searching = false;
      _searchHit = hit;
      _suggestions = const [];
      _searchError = null;
      _nearby = const [];
      _panelOpen = true;
      if (matching != null) {
        _selected = matching;
      }
    });

    _mapController.move(
      LatLng(hit.latitude, hit.longitude),
      hit.isSed ? 16 : 18,
    );

    if (matching != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF1565C0),
          content: Text('Este suministro está en tu tarea ${matching.task.title}'),
        ),
      );
    }

    if (!hit.isSed || user == null) return;
    try {
      final nearby = await deps.listSuppliesNearUseCase.execute(
        user,
        latitude: hit.latitude,
        longitude: hit.longitude,
      );
      if (!mounted || _searchHit?.code != hit.code) return;
      setState(() => _nearby = nearby);
      if (nearby.isEmpty) return;
      final points = <LatLng>[
        LatLng(hit.latitude, hit.longitude),
        ...nearby.map((item) => LatLng(item.latitude, item.longitude)),
      ];
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(points),
          padding: const EdgeInsets.fromLTRB(48, 100, 48, 240),
          maxZoom: 17,
        ),
      );
    } catch (_) {
      if (!mounted || _searchHit?.code != hit.code) return;
      setState(() => _nearby = const []);
    }
  }

  void _clearSearch() {
    _suggestTimer?.cancel();
    _searchFocus.unfocus();
    _searchController.clear();
    setState(() {
      _searchHit = null;
      _nearby = const [];
      _suggestions = const [];
      _searchError = null;
      _searching = false;
    });
  }

  Future<void> _openSearchNavigation(StationHit hit) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${hit.latitude},${hit.longitude}&travelmode=driving',
    );
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir Google Maps')),
      );
    }
  }

  Future<void> _openNavigation(RankedFieldTask item) async {
    if (!item.hasMapPoint) return;
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}&travelmode=driving',
    );
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir Google Maps')),
      );
    }
  }

  Future<void> _openNeighborhoodNavigation(FieldTask task) async {
    final uri = task.neighborhoodMapsUri;
    if (uri == null) return;
    if (task.hasNeighborhoodMapPoint) {
      _mapController.move(
        LatLng(task.neighborhoodLatitude!, task.neighborhoodLongitude!),
        16,
      );
    }
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir Google Maps')),
      );
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
      _applyUpdatedTask(updated);
      final areaLabel =
          item.task.areaName.trim().isEmpty ? 'la actividad' : item.task.areaName;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${result.images.length} foto(s) en $areaLabel · hoy',
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
    if (_uploading) return;
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

  void _applyUpdatedTask(FieldTask updated) {
    final ranked = applyUpdatedTaskToRanked(_ranked, updated);
    RankedFieldTask? selected;
    if (_selected != null) {
      for (final item in ranked) {
        if (item.key == _selected!.key) {
          selected = item;
          break;
        }
      }
    }
    setState(() {
      _ranked = ranked;
      _selected = selected ?? _selected;
    });
  }

  Future<void> _completeRoute(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _uploading) return;
    try {
      final updated = await deps.completeMyTaskRouteUseCase.execute(
        user,
        taskId: item.task.id,
        routeCode: item.routeCode,
      );
      if (!mounted) return;
      _applyUpdatedTask(updated);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF2E7D32),
          content: Text(
            updated.isCompleted
                ? 'Tarea completada. Avisamos a los demás técnicos.'
                : 'Suministro ${item.routeCode} en verde. Avisamos al equipo.',
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
    }
  }

  Future<void> _claimRoute(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _uploading) return;
    try {
      final updated = await deps.claimMyTaskRouteUseCase.execute(
        user,
        taskId: item.task.id,
        routeCode: item.routeCode,
      );
      if (!mounted) return;
      _applyUpdatedTask(updated);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF1565C0),
          content: Text(
            'Tomaste el suministro ${item.routeCode}. Los demás ya lo ven ocupado.',
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
        const SnackBar(content: Text('No se pudo tomar este punto')),
      );
    }
  }

  Future<void> _releaseRoute(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _uploading) return;
    try {
      final updated = await deps.releaseMyTaskRouteUseCase.execute(
        user,
        taskId: item.task.id,
        routeCode: item.routeCode,
      );
      if (!mounted) return;
      _applyUpdatedTask(updated);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Soltaste el suministro ${item.routeCode}')),
      );
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    }
  }

  Future<void> _saveGps(RankedFieldTask item) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _uploading) return;
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
      setState(() => _location = location);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('GPS guardado en ${item.routeCode}'),
        ),
      );
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    }
  }

  Color _markerColor(RankedFieldTask item, String userId) {
    if (item.routeCompleted || item.task.isCompleted) {
      return const Color(0xFF2E7D32);
    }
    if (item.isClaimedBy(userId)) {
      return const Color(0xFF1565C0);
    }
    if (item.isClaimed) {
      return const Color(0xFFEF6C00);
    }
    return const Color(0xFFC62828);
  }

  @override
  Widget build(BuildContext context) {
    final location = _location;
    final userId = context.watch<SessionController>().user?.id ?? '';
    final open = _mapPoints;
    final nearestOpen = open
        .where(
          (item) =>
              !item.routeCompleted &&
              (!item.isClaimed || item.isClaimedBy(userId)),
        )
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _focusedTask == null
              ? 'Mapa de tareas'
              : _focusedTask!.title,
        ),
        actions: [
          if (widget.focusedTaskId != null &&
              widget.focusedTaskId!.trim().isNotEmpty)
            TextButton(
              onPressed: widget.onClearTaskFocus,
              child: const Text('Ver todas'),
            ),
          IconButton(
            tooltip: 'Actualizar GPS',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.my_location_rounded),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _gpsRequired
              ? _GpsGate(
                  message: _error ?? 'Activa el GPS para ver el mapa.',
                  onRetry: _load,
                )
              : _error != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_error!, textAlign: TextAlign.center),
                            const SizedBox(height: 12),
                            FilledButton(
                              onPressed: _load,
                              child: const Text('Reintentar'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : location == null
                      ? const SizedBox.shrink()
                      : Stack(
                          children: [
                            FlutterMap(
                              mapController: _mapController,
                              options: MapOptions(
                                initialCenter: LatLng(
                                  location.latitude,
                                  location.longitude,
                                ),
                                initialZoom: 15,
                                onTap: (_, __) {
                                  _searchFocus.unfocus();
                                  if (_suggestions.isNotEmpty) {
                                    setState(() => _suggestions = const []);
                                  }
                                  if (_panelOpen) {
                                    setState(() => _panelOpen = false);
                                  }
                                },
                                interactionOptions: const InteractionOptions(
                                  flags: InteractiveFlag.all,
                                ),
                              ),
                              children: [
                                TileLayer(
                                  urlTemplate:
                                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                  userAgentPackageName:
                                      'com.consorcioselvamdd.tecnico',
                                ),
                                if (_searchHit != null && _searchHit!.isSed)
                                  CircleLayer(
                                    circles: [
                                      CircleMarker(
                                        point: LatLng(
                                          _searchHit!.latitude,
                                          _searchHit!.longitude,
                                        ),
                                        radius: sedFeederRadiusMeters,
                                        useRadiusInMeter: true,
                                        color: const Color(0x332E7D32),
                                        borderColor: const Color(0xFF2E7D32),
                                        borderStrokeWidth: 2,
                                      ),
                                    ],
                                  ),
                                MarkerLayer(
                                  markers: [
                                    Marker(
                                      point: LatLng(
                                        location.latitude,
                                        location.longitude,
                                      ),
                                      width: 44,
                                      height: 44,
                                      child: const _YouMarker(),
                                    ),
                                    ...open.map((item) {
                                      final selected =
                                          _searchHit == null &&
                                          _selected?.key == item.key;
                                      final shortCode = _shortCode(item.routeCode);
                                      return Marker(
                                        point: LatLng(
                                          item.latitude!,
                                          item.longitude!,
                                        ),
                                        width: selected ? 118 : 104,
                                        height: selected ? 56 : 50,
                                        alignment: Alignment.bottomCenter,
                                        child: GestureDetector(
                                          onTap: () => _selectTask(item),
                                          child: _TaskMarker(
                                            color: _markerColor(item, userId),
                                            code: shortCode,
                                            recommended: false,
                                            selected: selected,
                                          ),
                                        ),
                                      );
                                    }),
                                    ..._neighborhoodTasks.map((task) {
                                      return Marker(
                                        point: LatLng(
                                          task.neighborhoodLatitude!,
                                          task.neighborhoodLongitude!,
                                        ),
                                        width: 148,
                                        height: 56,
                                        alignment: Alignment.bottomCenter,
                                        child: GestureDetector(
                                          onTap: () =>
                                              _openNeighborhoodNavigation(task),
                                          child: _NeighborhoodMarker(
                                            code: _shortCode(
                                              task.neighborhoodRouteName,
                                            ),
                                          ),
                                        ),
                                      );
                                    }),
                                    ..._nearby.map((item) {
                                      final selected =
                                          _searchHit?.code == item.routeCode;
                                      return Marker(
                                        point: LatLng(
                                          item.latitude,
                                          item.longitude,
                                        ),
                                        width: selected ? 108 : 96,
                                        height: selected ? 52 : 46,
                                        alignment: Alignment.bottomCenter,
                                        child: GestureDetector(
                                          onTap: () => _searchRoute(
                                            raw: item.routeCode,
                                          ),
                                          child: _CatalogMarker(
                                            code: _shortCode(item.routeCode),
                                            selected: selected,
                                            sed: false,
                                          ),
                                        ),
                                      );
                                    }),
                                    if (_searchHit != null)
                                      Marker(
                                        point: LatLng(
                                          _searchHit!.latitude,
                                          _searchHit!.longitude,
                                        ),
                                        width: 124,
                                        height: 58,
                                        alignment: Alignment.bottomCenter,
                                        child: _CatalogMarker(
                                          code: _shortCode(_searchHit!.code),
                                          selected: true,
                                          sed: _searchHit!.isSed,
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                            Positioned(
                              top: 12,
                              left: 12,
                              right: 12,
                              child: _RouteSearchOverlay(
                                controller: _searchController,
                                focusNode: _searchFocus,
                                searching: _searching,
                                error: _searchError,
                                suggestions: _suggestions,
                                onChanged: _onSearchChanged,
                                onSubmitted: () => _searchRoute(),
                                onSelect: _selectSearchHit,
                                onClear: _searchController.text.isEmpty &&
                                        _searchHit == null
                                    ? null
                                    : _clearSearch,
                              ),
                            ),
                            Positioned(
                              left: 12,
                              right: 12,
                              bottom: 12,
                              child: _panelOpen
                                  ? (_searchHit != null
                                      ? _SearchHitPanel(
                                          hit: _searchHit!,
                                          nearby: _nearby,
                                          matchingTask: _taskForCode(
                                            _searchHit!.code,
                                          ),
                                          onClose: () {
                                            setState(() => _panelOpen = false);
                                          },
                                          onClear: _clearSearch,
                                          onNavigate: () =>
                                              _openSearchNavigation(_searchHit!),
                                          onPickNearby: (item) {
                                            _searchRoute(raw: item.routeCode);
                                          },
                                          onOpenTask: () {
                                            final matching = _taskForCode(
                                              _searchHit!.code,
                                            );
                                            if (matching != null) {
                                              _selectTask(matching);
                                            }
                                          },
                                          onCenterMe: () {
                                            _mapController.move(
                                              LatLng(
                                                location.latitude,
                                                location.longitude,
                                              ),
                                              16,
                                            );
                                          },
                                        )
                                      : _BottomPanel(
                                      focusedTask: _focusedTask,
                                      openCount: nearestOpen.length,
                                      missingGps: _missingGps,
                                      selected: _selected,
                                      currentUserId: userId,
                                      nearest: nearestOpen.isEmpty
                                          ? null
                                          : nearestOpen.first,
                                      onClose: () {
                                        setState(() => _panelOpen = false);
                                      },
                                      onSelectNearest: nearestOpen.isEmpty
                                          ? null
                                          : () => _selectTask(nearestOpen.first),
                                      onNavigate: _selected == null ||
                                              !_selected!.hasMapPoint
                                          ? null
                                          : () => _openNavigation(_selected!),
                                      onNavigateNeighborhood: (_selected?.task ??
                                                      _focusedTask)
                                                  ?.hasNeighborhoodRoute ==
                                              true
                                          ? () {
                                              final task = _selected?.task ??
                                                  _focusedTask;
                                              if (task == null) return;
                                              _openNeighborhoodNavigation(task);
                                            }
                                          : null,
                                      onClaim: _selected == null ||
                                              _selected!.routeCompleted ||
                                              _selected!.isClaimed
                                          ? null
                                          : () => _claimRoute(_selected!),
                                      onRelease: _selected == null ||
                                              !_selected!.isClaimedBy(userId) ||
                                              _selected!.routeCompleted
                                          ? null
                                          : () => _releaseRoute(_selected!),
                                      onSendPhotos:
                                          _selected == null || _uploading
                                              ? null
                                              : () => _addPhotos(_selected!),
                                      onComplete: _selected == null ||
                                              _selected!.routeCompleted ||
                                              !_selected!.isClaimedBy(userId)
                                          ? null
                                          : () => _completeRoute(_selected!),
                                      onSaveGps: _selected == null ||
                                              _selected!.hasMapPoint
                                          ? null
                                          : () => _saveGps(_selected!),
                                      onPickMissing: (item) {
                                        setState(() {
                                          _selected = item;
                                          _panelOpen = true;
                                        });
                                        if (item.hasMapPoint) {
                                          _selectTask(item);
                                        }
                                      },
                                      onCenterMe: () {
                                        _mapController.move(
                                          LatLng(
                                            location.latitude,
                                            location.longitude,
                                          ),
                                          16,
                                        );
                                      },
                                    )
                                      )
                                  : _ClosedPanelBar(
                                      selected: _selected,
                                      onOpen: () {
                                        setState(() => _panelOpen = true);
                                      },
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
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                              ),
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

class _NeighborhoodMarker extends StatelessWidget {
  const _NeighborhoodMarker({required this.code});

  final String code;

  @override
  Widget build(BuildContext context) {
    const color = Color(0xFF6A1B9A);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.45),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            'Vecinal $code',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 11,
            ),
          ),
        ),
        Container(
          width: 0,
          height: 0,
          decoration: const BoxDecoration(
            border: Border(
              left: BorderSide(width: 6, color: Colors.transparent),
              right: BorderSide(width: 6, color: Colors.transparent),
              top: BorderSide(width: 8, color: color),
            ),
          ),
        ),
      ],
    );
  }
}

class _CatalogMarker extends StatelessWidget {
  const _CatalogMarker({
    required this.code,
    required this.selected,
    required this.sed,
  });

  final String code;
  final bool selected;
  final bool sed;

  @override
  Widget build(BuildContext context) {
    final color = sed ? const Color(0xFF2E7D32) : const Color(0xFF00897B);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: EdgeInsets.symmetric(
            horizontal: selected ? 8 : 7,
            vertical: selected ? 5 : 4,
          ),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white, width: selected ? 2.5 : 2),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.45),
                blurRadius: selected ? 12 : 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            sed ? 'SED $code' : code,
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: selected ? 12 : 11,
            ),
          ),
        ),
        Container(
          width: 0,
          height: 0,
          decoration: BoxDecoration(
            border: Border(
              left: const BorderSide(width: 6, color: Colors.transparent),
              right: const BorderSide(width: 6, color: Colors.transparent),
              top: BorderSide(width: 8, color: color),
            ),
          ),
        ),
      ],
    );
  }
}

class _RouteSearchOverlay extends StatelessWidget {
  const _RouteSearchOverlay({
    required this.controller,
    required this.focusNode,
    required this.searching,
    required this.error,
    required this.suggestions,
    required this.onChanged,
    required this.onSubmitted,
    required this.onSelect,
    required this.onClear,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool searching;
  final String? error;
  final List<StationHit> suggestions;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmitted;
  final Future<void> Function(StationHit hit) onSelect;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(14),
          color: Theme.of(context).colorScheme.surface,
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            maxLength: 12,
            textInputAction: TextInputAction.search,
            onChanged: onChanged,
            onSubmitted: (_) => onSubmitted(),
            decoration: InputDecoration(
              hintText: 'Buscar ruta o SED',
              counterText: '',
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 14),
              prefixIcon: searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : const Icon(Icons.search_rounded),
              suffixIconConstraints: const BoxConstraints(
                minWidth: 0,
                minHeight: 48,
              ),
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (onClear != null)
                    IconButton(
                      tooltip: 'Limpiar',
                      onPressed: onClear,
                      icon: const Icon(Icons.close_rounded),
                    ),
                  IconButton(
                    tooltip: 'Buscar',
                    onPressed: onSubmitted,
                    icon: const Icon(Icons.arrow_forward_rounded),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (error != null && suggestions.isEmpty) ...[
          const SizedBox(height: 8),
          Material(
            elevation: 2,
            borderRadius: BorderRadius.circular(10),
            color: Theme.of(context).colorScheme.errorContainer,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  error!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onErrorContainer,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ],
        if (suggestions.isNotEmpty) ...[
          const SizedBox(height: 8),
          Material(
            elevation: 6,
            borderRadius: BorderRadius.circular(14),
            color: Theme.of(context).colorScheme.surface,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(vertical: 6),
                itemCount: suggestions.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final hit = suggestions[index];
                  return ListTile(
                    dense: true,
                    leading: Icon(
                      hit.isSed
                          ? Icons.electrical_services_rounded
                          : Icons.pin_drop_rounded,
                    ),
                    title: Text(
                      hit.code,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(
                      hit.isSed ? hit.detail : 'Suministro',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => onSelect(hit),
                  );
                },
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _SearchHitPanel extends StatelessWidget {
  const _SearchHitPanel({
    required this.hit,
    required this.nearby,
    required this.matchingTask,
    required this.onClose,
    required this.onClear,
    required this.onNavigate,
    required this.onPickNearby,
    required this.onOpenTask,
    required this.onCenterMe,
  });

  final StationHit hit;
  final List<NearbySupply> nearby;
  final RankedFieldTask? matchingTask;
  final VoidCallback onClose;
  final VoidCallback onClear;
  final VoidCallback onNavigate;
  final void Function(NearbySupply item) onPickNearby;
  final VoidCallback onOpenTask;
  final VoidCallback onCenterMe;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(18),
      color: Theme.of(context).colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    hit.isSed ? 'SED ${hit.code}' : 'Suministro ${hit.code}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                IconButton(
                  tooltip: 'Mi ubicación',
                  onPressed: onCenterMe,
                  icon: const Icon(Icons.my_location_rounded),
                ),
                IconButton(
                  tooltip: 'Cerrar',
                  onPressed: onClose,
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            Text(
              hit.detail,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (matchingTask != null) ...[
              const SizedBox(height: 8),
              Text(
                'Está en tu tarea ${matchingTask!.task.title}',
                style: const TextStyle(
                  color: Color(0xFF1565C0),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            if (hit.isSed && nearby.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                '${nearby.length} suministro${nearby.length == 1 ? '' : 's'} a 300 m',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 120),
                child: ListView(
                  shrinkWrap: true,
                  children: nearby.take(8).map((item) {
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        item.routeCode,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      trailing: Text(item.distanceLabel),
                      onTap: () => onPickNearby(item),
                    );
                  }).toList(),
                ),
              ),
            ],
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: onNavigate,
                  icon: const Icon(Icons.directions_rounded),
                  label: const Text('Cómo llegar'),
                ),
                if (matchingTask != null)
                  FilledButton.tonal(
                    onPressed: onOpenTask,
                    child: const Text('Ver en la tarea'),
                  ),
                TextButton(
                  onPressed: onClear,
                  child: const Text('Limpiar búsqueda'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _YouMarker extends StatelessWidget {
  const _YouMarker();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.brandBlue,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: const [
          BoxShadow(
            color: Color(0x66000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: const Icon(Icons.person_pin_circle, color: Colors.white, size: 22),
    );
  }
}

class _TaskMarker extends StatelessWidget {
  const _TaskMarker({
    required this.color,
    required this.code,
    required this.recommended,
    required this.selected,
  });

  final Color color;
  final String code;
  final bool recommended;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: EdgeInsets.symmetric(
            horizontal: selected ? 8 : 7,
            vertical: selected ? 5 : 4,
          ),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: Colors.white,
              width: selected ? 2.5 : 2,
            ),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.45),
                blurRadius: selected ? 12 : 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            recommended ? '★ $code' : code,
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: selected ? 12 : 11,
              letterSpacing: 0.2,
            ),
          ),
        ),
        Container(
          width: 0,
          height: 0,
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(
                width: 6,
                color: Colors.transparent,
              ),
              right: BorderSide(
                width: 6,
                color: Colors.transparent,
              ),
              top: BorderSide(width: 8, color: color),
            ),
          ),
        ),
      ],
    );
  }
}

class _BottomPanel extends StatelessWidget {
  const _BottomPanel({
    required this.focusedTask,
    required this.openCount,
    required this.missingGps,
    required this.selected,
    required this.currentUserId,
    required this.nearest,
    required this.onSelectNearest,
    required this.onNavigate,
    this.onNavigateNeighborhood,
    required this.onCenterMe,
    required this.onPickMissing,
    required this.onClose,
    this.onClaim,
    this.onRelease,
    this.onSendPhotos,
    this.onComplete,
    this.onSaveGps,
  });

  final FieldTask? focusedTask;
  final int openCount;
  final List<RankedFieldTask> missingGps;
  final RankedFieldTask? selected;
  final String currentUserId;
  final RankedFieldTask? nearest;
  final VoidCallback? onSelectNearest;
  final VoidCallback? onNavigate;
  final VoidCallback? onNavigateNeighborhood;
  final VoidCallback onCenterMe;
  final void Function(RankedFieldTask item) onPickMissing;
  final VoidCallback onClose;
  final VoidCallback? onClaim;
  final VoidCallback? onRelease;
  final VoidCallback? onSendPhotos;
  final VoidCallback? onComplete;
  final VoidCallback? onSaveGps;

  @override
  Widget build(BuildContext context) {
    final item = selected;
    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(18),
      color: Theme.of(context).colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    focusedTask != null
                        ? (openCount == 0
                            ? 'Puntos de esta tarea'
                            : '$openCount punto${openCount == 1 ? '' : 's'} de esta tarea')
                        : openCount == 0
                            ? 'Sin puntos con GPS'
                            : '$openCount suministro${openCount == 1 ? '' : 's'} en ruta',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                IconButton(
                  tooltip: 'Mi ubicación',
                  onPressed: onCenterMe,
                  icon: const Icon(Icons.my_location_rounded),
                ),
                IconButton(
                  tooltip: 'Cerrar',
                  onPressed: onClose,
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            if (nearest != null &&
                (item == null || item.key != nearest!.key))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: onSelectNearest,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Más cerca: ${nearest!.task.title} · '
                      '${nearest!.routeCode} · '
                      '${formatTaskDistance(nearest!.distanceMeters)}',
                      style: const TextStyle(
                        color: Color(0xFF2E7D32),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
            if (missingGps.isNotEmpty) ...[
              Text(
                'Sin ubicación: activa el GPS en el punto',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                children: missingGps
                    .take(6)
                    .map(
                      (route) => ActionChip(
                        label: Text(route.routeCode),
                        onPressed: () => onPickMissing(route),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 8),
            ],
            if (item != null) ...[
              Text(
                item.task.title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (item.task.isJointAssignment) ...[
                const SizedBox(height: 4),
                Text(
                  item.task.jointAssignmentLabel,
                  style: const TextStyle(
                    color: Color(0xFF1565C0),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 4),
              Text(
                [
                  'Suministro ${item.routeCode}',
                  if (item.routeCompleted) 'Completado · verde',
                  if (!item.routeCompleted && item.isClaimedBy(currentUserId))
                    'Lo tomaste tú · azul',
                  if (!item.routeCompleted &&
                      item.isClaimed &&
                      !item.isClaimedBy(currentUserId))
                    'Tomado por ${item.claimedByName}',
                  if (!item.routeCompleted && !item.isClaimed) 'Libre · rojo',
                  if (!item.routeCompleted && item.photosUploaded)
                    'Fotos listas',
                  if (!item.routeCompleted &&
                      item.isClaimedBy(currentUserId) &&
                      !item.photosUploaded)
                    'Faltan fotos',
                  formatTaskDistance(item.distanceMeters),
                  item.task.statusLabel,
                ].join(' · '),
                style: TextStyle(
                  color: item.routeCompleted
                      ? const Color(0xFF2E7D32)
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onSendPhotos,
                      icon: const Icon(Icons.photo_camera_rounded),
                      label: Text(
                        item.photosUploaded ? 'Más fotos' : 'Fotos',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: onNavigate,
                      icon: const Icon(Icons.directions_rounded),
                      label: const Text('Cómo llegar'),
                    ),
                  ),
                ],
              ),
              if (onNavigateNeighborhood != null) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: onNavigateNeighborhood,
                    icon: const Icon(Icons.alt_route_rounded),
                    label: const Text('Ruta vecinal'),
                  ),
                ),
              ],
              if (onClaim != null) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onClaim,
                    icon: const Icon(Icons.front_hand_rounded),
                    label: const Text('Agarrar este punto'),
                  ),
                ),
              ],
              if (onRelease != null) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: onRelease,
                    child: const Text('Soltar punto'),
                  ),
                ),
              ],
              if (onSaveGps != null) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: onSaveGps,
                    icon: const Icon(Icons.gps_fixed_rounded),
                    label: const Text('Activar GPS y guardar punto'),
                  ),
                ),
              ],
              if (onComplete != null) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onComplete,
                    icon: const Icon(Icons.check_circle_rounded),
                    label: const Text('Completar este punto'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF2E7D32),
                    ),
                  ),
                ),
              ],
            ] else if (openCount == 0 && missingGps.isEmpty)
              Text(
                focusedTask != null
                    ? 'Esta tarea aún no tiene puntos con GPS. Activa el GPS en cada suministro.'
                    : 'Asigna tareas con rutas de suministro para verlas aquí.',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ClosedPanelBar extends StatelessWidget {
  const _ClosedPanelBar({
    required this.selected,
    required this.onOpen,
  });

  final RankedFieldTask? selected;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final item = selected;
    final subtitle = item == null
        ? 'Toca un punto o abre el detalle'
        : [
            'Suministro ${item.routeCode}',
            formatTaskDistance(item.distanceMeters),
          ].join(' · ');

    return Material(
      elevation: 8,
      borderRadius: BorderRadius.circular(18),
      color: Theme.of(context).colorScheme.surface,
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
          child: Row(
            children: [
              const Icon(Icons.expand_less_rounded),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item?.task.title ?? 'Ver detalle',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Abrir detalle',
                onPressed: onOpen,
                icon: const Icon(Icons.keyboard_arrow_up_rounded),
              ),
            ],
          ),
        ),
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
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.location_off_rounded, size: 48),
          const SizedBox(height: 12),
          const Text(
            'GPS obligatorio',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
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
