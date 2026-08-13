import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/image_folder.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../../domain/value_objects/geo_location.dart';
import '../services/device_location_service.dart';
import '../services/image_picker_service.dart';
import '../state/session_controller.dart';

class CreateEditFolderPage extends StatefulWidget {
  const CreateEditFolderPage({super.key, this.folder});

  final ImageFolder? folder;

  @override
  State<CreateEditFolderPage> createState() => _CreateEditFolderPageState();
}

class _CreateEditFolderPageState extends State<CreateEditFolderPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _picker = ImagePickerService();
  final _locationService = DeviceLocationService();

  final List<ImageFilePayload> _pendingPhotos = [];
  GeoLocation? _capturedLocation;
  bool _saving = false;
  String _status = '';

  bool get _isEdit => widget.folder != null;

  @override
  void initState() {
    super.initState();
    final folder = widget.folder;
    if (folder != null) {
      _nameController.text = folder.name;
      _descriptionController.text = folder.description;
      _capturedLocation = folder.location;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _addCameraPhoto() async {
    final photo = await _picker.takePhoto();
    if (photo == null) return;
    setState(() => _pendingPhotos.add(photo));
  }

  Future<void> _addGalleryPhotos() async {
    final photos = await _picker.pickFromGallery(multiple: true);
    if (photos.isEmpty) return;
    setState(() => _pendingPhotos.addAll(photos));
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    setState(() {
      _saving = true;
      _status = _isEdit ? 'Guardando...' : 'Obteniendo GPS...';
    });

    try {
      late final ImageFolder folder;
      if (_isEdit) {
        folder = await deps.updateFolderUseCase.execute(
          user,
          folderId: widget.folder!.id,
          name: _nameController.text,
          description: _descriptionController.text,
        );
      } else {
        final location = await _locationService.getCurrentLocation();
        if (!mounted) return;
        setState(() {
          _capturedLocation = location;
          _status = 'Creando carpeta...';
        });

        folder = await deps.createFolderUseCase.execute(
          user,
          name: _nameController.text,
          description: _descriptionController.text,
          location: location,
        );
      }

      if (_pendingPhotos.isNotEmpty) {
        GeoLocation? uploadLocation = folder.location ?? _capturedLocation;
        if (!_isEdit && uploadLocation == null) {
          uploadLocation = await _locationService.getCurrentLocation();
        } else if (_isEdit) {
          try {
            uploadLocation = await _locationService.getCurrentLocation();
          } on DomainException {
            uploadLocation = folder.location;
          }
        }

        await deps.uploadFolderImagesUseCase.execute(
          user,
          folderId: folder.id,
          files: _pendingPhotos,
          location: uploadLocation,
          onProgress: (current, total) {
            if (!mounted) return;
            setState(() => _status = 'Subiendo $current de $total...');
          },
        );
      }

      if (!mounted) return;
      if (_isEdit) {
        Navigator.pop(context, true);
      } else {
        Navigator.pop(context, folder.id);
      }
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo guardar la carpeta')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _status = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final location = _capturedLocation;

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Editar carpeta' : 'Nueva carpeta'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            TextFormField(
              controller: _nameController,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Nombre de la carpeta',
                hintText: 'Ej: Trabajo sector 3',
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Ponle un nombre claro';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _descriptionController,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Descripción (opcional)',
                hintText: 'Detalle breve del trabajo',
              ),
            ),
            const SizedBox(height: 18),
            Builder(
              builder: (context) {
                final isDark = Theme.of(context).brightness == Brightness.dark;
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF1F3A2C)
                        : const Color(0xFFF0F7F2),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isDark
                          ? const Color(0xFF2F5A40)
                          : const Color(0xFFC8E0D0),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.location_on_rounded,
                        color: isDark
                            ? const Color(0xFF81C784)
                            : const Color(0xFF1B7A4B),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _isEdit
                                  ? 'Ubicación de la carpeta'
                                  : 'GPS obligatorio al crear',
                              style: const TextStyle(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _isEdit
                                  ? (location != null
                                      ? '${location.latitude.toStringAsFixed(5)}, ${location.longitude.toStringAsFixed(5)}'
                                      : 'Esta carpeta aún no tiene GPS guardado.')
                                  : 'Al crear, capturaremos tu ubicación actual. Mantén el GPS encendido.',
                              style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 22),
            const Text(
              'Fotos',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            const Text(
              'Puedes tomar fotos ahora o agregarlas después.',
              style: TextStyle(color: Color(0xFF6B7385)),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _saving
                        ? null
                        : () => showPhotoSourceSheet(
                              context: context,
                              onCamera: _addCameraPhoto,
                              onGallery: _addGalleryPhotos,
                            ),
                    icon: const Icon(Icons.add_a_photo_rounded),
                    label: const Text('Agregar fotos'),
                  ),
                ),
              ],
            ),
            if (_pendingPhotos.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                '${_pendingPhotos.length} foto(s) listas para subir',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: List.generate(_pendingPhotos.length, (index) {
                  final photo = _pendingPhotos[index];
                  return Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.memory(
                          photo.bytes,
                          width: 88,
                          height: 88,
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: InkWell(
                          onTap: _saving
                              ? null
                              : () => setState(
                                    () => _pendingPhotos.removeAt(index),
                                  ),
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            padding: const EdgeInsets.all(2),
                            child: const Icon(
                              Icons.close_rounded,
                              size: 16,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                }),
              ),
            ],
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              child: Text(
                _saving
                    ? (_status.isEmpty ? 'Guardando...' : _status)
                    : (_isEdit ? 'Guardar cambios' : 'Crear y continuar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
