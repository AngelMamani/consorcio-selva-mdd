import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../domain/entities/mobile_app_release.dart';
import '../theme/app_theme.dart';

Future<void> showAppUpdateDialog(
  BuildContext context, {
  required MobileAppRelease release,
  required int installedVersionCode,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: !release.forceUpdate,
    builder: (context) {
      return PopScope(
        canPop: !release.forceUpdate,
        child: _AppUpdateDialog(
          release: release,
          installedVersionCode: installedVersionCode,
        ),
      );
    },
  );
}

class _AppUpdateDialog extends StatelessWidget {
  const _AppUpdateDialog({
    required this.release,
    required this.installedVersionCode,
  });

  final MobileAppRelease release;
  final int installedVersionCode;

  Future<void> _download() async {
    final uri = Uri.tryParse(release.apkUrl);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 24, 22, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: AppTheme.brandBlue.withValues(alpha: 0.14),
              foregroundColor: AppTheme.brandBlue,
              child: const Icon(Icons.system_update_rounded, size: 36),
            ),
            const SizedBox(height: 16),
            const Text(
              'Hay una nueva versión',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tienes el código $installedVersionCode. '
              'Ya está ${release.versionName} (código ${release.versionCode}).'
              '${release.notes.trim().isEmpty ? '' : '\n\n${release.notes.trim()}'}'
              '\n\nDescárgala e instálala. El celular pedirá confirmar.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                height: 1.4,
                color: Theme.of(context).textTheme.bodyMedium?.color,
              ),
            ),
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _download,
                child: const Text('Descargar actualización'),
              ),
            ),
            if (!release.forceUpdate) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Ahora no'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
