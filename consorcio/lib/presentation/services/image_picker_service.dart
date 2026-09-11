import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;

import '../../domain/entities/area.dart';
import '../../domain/repositories/folder_image_repository.dart';

class ImagePickerService {
  ImagePickerService({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  Future<List<ImageFilePayload>> pickFromGallery({
    bool multiple = true,
  }) async {
    if (multiple) {
      final files = await _picker.pickMultiImage(
        imageQuality: 85,
        maxWidth: 1920,
      );
      return _mapFiles(files);
    }

    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 1920,
    );
    if (file == null) return [];
    return _mapFiles([file]);
  }

  Future<ImageFilePayload?> takePhoto({
    int imageQuality = 70,
    double maxWidth = 1280,
  }) async {
    final file = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: imageQuality,
      maxWidth: maxWidth,
      preferredCameraDevice: CameraDevice.rear,
    );
    if (file == null) return null;
    final mapped = await _mapFiles([file]);
    return mapped.isEmpty ? null : mapped.first;
  }

  Future<ImageFilePayload?> takeAttendancePhoto() {
    return takePhoto(imageQuality: 68, maxWidth: 1280);
  }

  Future<List<ImageFilePayload>> _mapFiles(List<XFile> files) async {
    final payloads = <ImageFilePayload>[];
    for (final file in files) {
      final bytes = await file.readAsBytes();
      payloads.add(
        ImageFilePayload(
          fileName: p.basename(file.name),
          contentType: file.mimeType ?? _guessMime(file.name),
          bytes: Uint8List.fromList(bytes),
        ),
      );
    }
    return payloads;
  }

  String _guessMime(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }
}

Future<String?> askOptionalPhotoNote(BuildContext context) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: const Text('Nota de las fotos'),
        content: TextField(
          controller: controller,
          maxLength: 200,
          maxLines: 3,
          textCapitalization: TextCapitalization.sentences,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Nota descriptiva (opcional)',
            hintText: 'Ej. Medidor dañado, se cambió el fusible',
            alignLabelWithHint: true,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Continuar'),
          ),
        ],
      );
    },
  ).whenComplete(controller.dispose);
}

Future<Area?> pickActivityArea(
  BuildContext context, {
  required List<Area> areas,
  String? preferredAreaId,
  String title = '¿Qué actividad estás haciendo?',
}) {
  if (areas.isEmpty) {
    return Future.value(null);
  }
  if (areas.length == 1) {
    return Future.value(areas.first);
  }

  final preferred = preferredAreaId?.trim();

  return showModalBottomSheet<Area>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) {
      final sorted = [...areas]
        ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Las fotos se guardan en la carpeta del suministro de esa actividad, con la fecha de hoy.',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * 0.45,
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: sorted.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (context, index) {
                    final area = sorted[index];
                    final isPreferred =
                        preferred != null && preferred.isNotEmpty && area.id == preferred;
                    return ListTile(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(
                          color: isPreferred
                              ? const Color(0xFF1565C0)
                              : Theme.of(context).dividerColor,
                        ),
                      ),
                      leading: Icon(
                        Icons.folder_special_rounded,
                        color: isPreferred
                            ? const Color(0xFF1565C0)
                            : Theme.of(context).colorScheme.primary,
                      ),
                      title: Text(
                        area.name,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: area.description.trim().isEmpty
                          ? null
                          : Text(area.description),
                      trailing: isPreferred
                          ? const Text(
                              'De tu tarea',
                              style: TextStyle(
                                color: Color(0xFF1565C0),
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            )
                          : const Icon(Icons.chevron_right_rounded),
                      onTap: () => Navigator.pop(context, area),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancelar'),
              ),
            ],
          ),
        ),
      );
    },
  );
}

Future<void> showPhotoSourceSheet({
  required BuildContext context,
  required Future<void> Function() onCamera,
  required Future<void> Function() onGallery,
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Agregar fotos',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              const Text(
                'En campo usa la cámara. Si ya las tienes, elige galería.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF6B7385)),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () async {
                    Navigator.pop(context);
                    await onCamera();
                  },
                  icon: const Icon(Icons.photo_camera_rounded),
                  label: const Text('Tomar foto'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    Navigator.pop(context);
                    await onGallery();
                  },
                  icon: const Icon(Icons.photo_library_rounded),
                  label: const Text('Elegir de galería'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                    textStyle: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
