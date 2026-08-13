import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/folder_image.dart';
import '../../domain/entities/image_folder.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../services/device_location_service.dart';
import '../services/image_picker_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'create_edit_folder_page.dart';

class FolderDetailPage extends StatefulWidget {
  const FolderDetailPage({super.key, required this.folderId});

  final String folderId;

  @override
  State<FolderDetailPage> createState() => _FolderDetailPageState();
}

class _FolderDetailPageState extends State<FolderDetailPage> {
  ImageFolder? _folder;
  List<FolderImage> _images = [];
  bool _loading = true;
  bool _uploading = false;
  String? _error;
  String _uploadStatus = '';
  final _picker = ImagePickerService();
  final _locationService = DeviceLocationService();

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
      final detail =
          await deps.getFolderDetailUseCase.execute(user, widget.folderId);
      if (!mounted) return;
      setState(() {
        _folder = detail.folder;
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
        _error = 'No se pudo abrir la carpeta';
        _loading = false;
      });
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
      _uploadStatus = 'Obteniendo GPS...';
    });

    try {
      final location = await _locationService.getCurrentLocation();
      if (!mounted) return;
      setState(() => _uploadStatus = 'Subiendo...');

      await deps.uploadFolderImagesUseCase.execute(
        user,
        folderId: widget.folderId,
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

  Future<void> _editFolder() async {
    final folder = _folder;
    if (folder == null) return;
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateEditFolderPage(folder: folder),
      ),
    );
    if (updated == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final folder = _folder;

    return Scaffold(
      appBar: AppBar(
        title: Text(folder?.name ?? 'Carpeta'),
        actions: [
          if (folder != null)
            IconButton(
              tooltip: 'Editar',
              onPressed: _uploading ? null : _editFolder,
              icon: const Icon(Icons.edit_rounded),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _uploading || _loading ? null : _addPhotos,
        icon: const Icon(Icons.photo_camera_rounded),
        label: Text(_uploading ? _uploadStatus : 'Subir fotos'),
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
                                folder?.description.isNotEmpty == true
                                    ? folder!.description
                                    : 'Sin descripción',
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
                              if (folder?.hasLocation == true) ...[
                                const SizedBox(height: 8),
                                Text(
                                  'GPS: ${folder!.location!.latitude.toStringAsFixed(5)}, ${folder.location!.longitude.toStringAsFixed(5)}',
                                  style: const TextStyle(
                                    color: Color(0xFF6B7385),
                                    fontSize: 13,
                                  ),
                                ),
                              ],
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
                                'Esta carpeta está vacía.\nToca “Subir fotos” para agregar.',
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
                                          insetPadding: const EdgeInsets.all(16),
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
