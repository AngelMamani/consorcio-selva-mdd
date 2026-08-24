import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

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

class TasksMapPage extends StatefulWidget {
  const TasksMapPage({super.key});

  @override
  State<TasksMapPage> createState() => _TasksMapPageState();
}

class _TasksMapPageState extends State<TasksMapPage> {
  final _locationService = DeviceLocationService();
  final _picker = ImagePickerService();
  final _mapController = MapController();

  List<RankedFieldTask> _ranked = [];
  GeoLocation? _location;
  RankedFieldTask? _selected;
  bool _loading = true;
  bool _uploading = false;
  String _uploadStatus = '';
  bool _gpsRequired = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  List<RankedFieldTask> get _openWithPoint => _ranked
      .where((item) => !item.task.isCompleted && item.hasMapPoint)
      .toList();

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
      final tasks = await deps.listMyTasksUseCase.execute(user);
      final ranked = await deps.rankMyTasksByProximityUseCase.execute(
        tasks: tasks,
        location: location,
      );
      if (!mounted) return;

      final open = ranked
          .where((item) => !item.task.isCompleted && item.hasMapPoint)
          .toList();
      final selected = open.isEmpty ? null : open.first;

      setState(() {
        _location = location;
        _ranked = ranked;
        _selected = selected;
        _loading = false;
      });

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _fitMap(location, open);
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

  void _fitMap(GeoLocation location, List<RankedFieldTask> open) {
    final points = <LatLng>[
      LatLng(location.latitude, location.longitude),
      ...open
          .take(8)
          .map((item) => LatLng(item.latitude!, item.longitude!)),
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
    setState(() => _selected = item);
    _mapController.move(
      LatLng(item.latitude!, item.longitude!),
      17,
    );
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

  Color _markerColor(RankedFieldTask item) {
    if (item.isRecommended) return const Color(0xFF2E7D32);
    if (item.task.isInProgress) return const Color(0xFF1565C0);
    return const Color(0xFFEF6C00);
  }

  @override
  Widget build(BuildContext context) {
    final location = _location;
    final open = _openWithPoint;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mapa de tareas'),
        actions: [
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
                                          _selected?.task.id == item.task.id;
                                      final code = item.task.routeCode.trim();
                                      final shortCode = code.length <= 6
                                          ? code
                                          : code.substring(code.length - 6);
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
                                            color: _markerColor(item),
                                            code: shortCode.isEmpty
                                                ? '•'
                                                : shortCode,
                                            recommended: item.isRecommended,
                                            selected: selected,
                                          ),
                                        ),
                                      );
                                    }),
                                  ],
                                ),
                              ],
                            ),
                            Positioned(
                              left: 12,
                              right: 12,
                              bottom: 12,
                              child: _BottomPanel(
                                openCount: open.length,
                                selected: _selected,
                                nearest: open.isEmpty ? null : open.first,
                                onSelectNearest: open.isEmpty
                                    ? null
                                    : () => _selectTask(open.first),
                                onNavigate: _selected == null
                                    ? null
                                    : () => _openNavigation(_selected!),
                                onSendPhotos: _selected == null || _uploading
                                    ? null
                                    : () => _addPhotos(_selected!),
                                onCenterMe: () {
                                  _mapController.move(
                                    LatLng(
                                      location.latitude,
                                      location.longitude,
                                    ),
                                    16,
                                  );
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
    required this.openCount,
    required this.selected,
    required this.nearest,
    required this.onSelectNearest,
    required this.onNavigate,
    required this.onCenterMe,
    this.onSendPhotos,
  });

  final int openCount;
  final RankedFieldTask? selected;
  final RankedFieldTask? nearest;
  final VoidCallback? onSelectNearest;
  final VoidCallback? onNavigate;
  final VoidCallback onCenterMe;
  final VoidCallback? onSendPhotos;

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
                    openCount == 0
                        ? 'Sin tareas con ubicación'
                        : '$openCount suministro${openCount == 1 ? '' : 's'} en ruta',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                IconButton(
                  tooltip: 'Mi ubicación',
                  onPressed: onCenterMe,
                  icon: const Icon(Icons.my_location_rounded),
                ),
              ],
            ),
            if (nearest != null &&
                (item == null || item.task.id != nearest!.task.id))
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
                      '${formatTaskDistance(nearest!.distanceMeters)}',
                      style: const TextStyle(
                        color: Color(0xFF2E7D32),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
            if (item != null) ...[
              Text(
                item.task.title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                [
                  if (item.task.routeCode.isNotEmpty)
                    'Suministro ${item.task.routeCode}',
                  formatTaskDistance(item.distanceMeters),
                  item.task.statusLabel,
                ].join(' · '),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
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
                      label: const Text('Fotos'),
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
            ] else if (openCount == 0)
              Text(
                'Asigna tareas con código de suministro para verlas aquí.',
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
