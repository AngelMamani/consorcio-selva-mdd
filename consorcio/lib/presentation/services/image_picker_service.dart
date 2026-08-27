import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;

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

  Future<ImageFilePayload?> takePhoto() async {
    final file = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
      maxWidth: 1920,
      preferredCameraDevice: CameraDevice.rear,
    );
    if (file == null) return null;
    final mapped = await _mapFiles([file]);
    return mapped.isEmpty ? null : mapped.first;
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
