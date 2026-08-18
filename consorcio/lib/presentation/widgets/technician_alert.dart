import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum TechnicianAlertKind { success, error, info }

Future<void> showTechnicianAlert(
  BuildContext context, {
  required TechnicianAlertKind kind,
  required String title,
  required String message,
  String confirmLabel = 'Entendido',
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (context) {
      return PopScope(
        canPop: false,
        child: TechnicianAlertDialog(
          kind: kind,
          title: title,
          message: message,
          confirmLabel: confirmLabel,
        ),
      );
    },
  );
}

class TechnicianAlertDialog extends StatelessWidget {
  const TechnicianAlertDialog({
    super.key,
    required this.kind,
    required this.title,
    required this.message,
    this.confirmLabel = 'Entendido',
  });

  final TechnicianAlertKind kind;
  final String title;
  final String message;
  final String confirmLabel;

  Color get _color {
    switch (kind) {
      case TechnicianAlertKind.success:
        return AppTheme.brandGreen;
      case TechnicianAlertKind.error:
        return const Color(0xFFD32F2F);
      case TechnicianAlertKind.info:
        return AppTheme.brandBlue;
    }
  }

  IconData get _icon {
    switch (kind) {
      case TechnicianAlertKind.success:
        return Icons.check_circle_rounded;
      case TechnicianAlertKind.error:
        return Icons.error_rounded;
      case TechnicianAlertKind.info:
        return Icons.info_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color;
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
              backgroundColor: color.withValues(alpha: 0.14),
              foregroundColor: color,
              child: Icon(_icon, size: 36),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
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
                onPressed: () => Navigator.of(context).pop(),
                child: Text(confirmLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
