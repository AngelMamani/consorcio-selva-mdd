import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/folder_date.dart';
import '../../domain/entities/folder_image.dart';
import '../../domain/entities/image_folder.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../../domain/value_objects/geo_location.dart';
import '../services/device_location_service.dart';
import '../services/image_picker_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';

class FolderDateDetailPage extends StatefulWidget {
  const FolderDateDetailPage({
    super.key,
    required this.folderId,
    required this.dateId,
  });

  final String folderId;
  final String dateId;

  @override
  State<FolderDateDetailPage> createState() => _FolderDateDetailPageState();
}

class _FolderDateDetailPageState extends State<FolderDateDetailPage> {
  ImageFolder? _folder;
  FolderDate? _folderDate;
  List<FolderImage> _images = [];
  bool _loading = true;
  bool _uploading = false;
  bool _assigningLocation = false;
  String? _error;
  String _uploadStatus = '';
  final _picker = ImagePickerService();
  final _locationService = DeviceLocationService();

  bool get _needsLocation => _folder != null && !_folder!.hasLocation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
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
      final detail = await deps.getFolderDateDetailUseCase.execute(
        user,
        folderId: widget.folderId,
        dateId: widget.dateId,
      );
      if (!mounted) return;
      setState(() {
        _folder = detail.folder;
        _folderDate = detail.folderDate;
        _images = detail.images;
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
        _error = 'No se pudo abrir la fecha';
        _loading = false;
      });
    }
  }

  Future<bool> _assignLocation() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return false;

    setState(() => _assigningLocation = true);

    try {
      final location = await _locationService.getCurrentLocation();
      final updated = await deps.assignFolderLocationUseCase.execute(
        user,
        folderId: widget.folderId,
        location: location,
      );
      if (!mounted) return false;
      setState(() => _folder = updated);
      return true;
    } on DomainException catch (error) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
      return false;
    } catch (_) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo asignar la ubicación GPS')),
      );
      return false;
    } finally {
      if (mounted) setState(() => _assigningLocation = false);
    }
  }

  Future<void> _uploadFiles(List<ImageFilePayload> files) async {
    if (files.isEmpty) return;
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    setState(() {
      _uploading = true;
      _uploadStatus = _needsLocation ? 'Obteniendo GPS...' : 'Subiendo...';
    });

    try {
      GeoLocation? location;

      if (_needsLocation) {
        location = await _locationService.getCurrentLocation();
        if (!mounted) return;
        setState(() => _uploadStatus = 'Asignando ubicación...');
        final updated = await deps.assignFolderLocationUseCase.execute(
          user,
          folderId: widget.folderId,
          location: location,
        );
        if (!mounted) return;
        setState(() {
          _folder = updated;
          _uploadStatus = 'Subiendo...';
        });
      }

      await deps.uploadFolderImagesUseCase.execute(
        user,
        folderId: widget.folderId,
        dateId: widget.dateId,
        files: files,
        location: location,
        onProgress: (current, total) {
          if (!mounted) return;
          setState(() => _uploadStatus = 'Subiendo $current de $total...');
        },
      );
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fotos subidas correctamente')),
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

  Future<void> _addPhotos() async {
    if (_needsLocation) {
      final assigned = await _assignLocation();
      if (!assigned) return;
    }
    if (!mounted) return;

    await showPhotoSourceSheet(
      context: context,
      onCamera: () async {
        final photo = await _picker.takePhoto();
        if (photo != null) await _uploadFiles([photo]);
      },
      onGallery: () async {
        final photos = await _picker.pickFromGallery(multiple: true);
        await _uploadFiles(photos);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final folderDate = _folderDate;
    final busy = _uploading || _assigningLocation;

    return Scaffold(
      appBar: AppBar(
        title: Text(folderDate?.formattedLabel ?? 'Fecha'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _loading || busy ? null : _addPhotos,
        icon: Icon(
          _needsLocation
              ? Icons.my_location_rounded
              : Icons.photo_camera_rounded,
        ),
        label: Text(
          _assigningLocation
              ? 'Asignando GPS...'
              : _uploading
                  ? _uploadStatus
                  : _needsLocation
                      ? 'Activar GPS'
                      : 'Subir fotos',
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, textAlign: TextAlign.center),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                folderDate?.note.isNotEmpty == true
                                    ? folderDate!.note
                                    : 'Sin nota',
                                style: const TextStyle(
                                  color: Color(0xFF6B7385),
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${_images.length} foto(s)',
                                style: const TextStyle(
                                  color: AppTheme.brandGreen,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              if (_uploading) ...[
                                const SizedBox(height: 12),
                                LinearProgressIndicator(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  _uploadStatus,
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      if (_images.isEmpty)
                        const SliverFillRemaining(
                          hasScrollBody: false,
                          child: Center(
                            child: Padding(
                              padding: EdgeInsets.all(24),
                              child: Text(
                                'Esta fecha está vacía.\nToca “Subir fotos” para agregar.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Color(0xFF6B7385)),
                              ),
                            ),
                          ),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                          sliver: SliverGrid(
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              mainAxisSpacing: 10,
                              crossAxisSpacing: 10,
                            ),
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                final image = _images[index];
                                return ClipRRect(
                                  borderRadius: BorderRadius.circular(14),
                                  child: InkWell(
                                    onTap: () {
                                      showDialog<void>(
                                        context: context,
                                        builder: (context) => Dialog(
                                          insetPadding:
                                              const EdgeInsets.all(16),
                                          child: InteractiveViewer(
                                            child: Image.network(
                                              image.downloadUrl,
                                              fit: BoxFit.contain,
                                            ),
                                          ),
                                        ),
                                      );
                                    },
                                    child: Image.network(
                                      image.downloadUrl,
                                      fit: BoxFit.cover,
                                      loadingBuilder:
                                          (context, child, progress) {
                                        if (progress == null) return child;
                                        return const ColoredBox(
                                          color: Color(0xFFE8EEF5),
                                          child: Center(
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          ),
                                        );
                                      },
                                      errorBuilder: (_, __, ___) =>
                                          const ColoredBox(
                                        color: Color(0xFFE8EEF5),
                                        child: Icon(Icons.broken_image_rounded),
                                      ),
                                    ),
                                  ),
                                );
                              },
                              childCount: _images.length,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }
}
