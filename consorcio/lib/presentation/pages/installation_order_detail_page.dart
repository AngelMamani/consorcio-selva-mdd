import 'package:flutter/material.dart';

import '../../domain/entities/installation_order.dart';

class InstallationOrderDetailPage extends StatelessWidget {
  const InstallationOrderDetailPage({super.key, required this.order});

  final InstallationOrder order;

  String _meterTypeLabel(String subType) {
    final raw = subType.trim().toUpperCase();
    if (raw.contains('C2') || raw.contains('TRIFAS')) {
      return 'C2 — Trifásico';
    }
    return 'C1 — Monofásico';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Orden de trabajo')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          Text(
            order.orderNumber,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(height: 16),
          _Field(
            label: 'SUB TIPO',
            value: _meterTypeLabel(order.subType),
          ),
          _Field(label: 'SOLICITANTE', value: order.applicantName),
          _Field(
            label: 'DIRECCION SOLICITANTE',
            value: order.applicantAddress,
          ),
          _Field(
            label: 'SMDD',
            value: order.sectorCijp,
            icon: Icons.warehouse_outlined,
            color: const Color(0xFFEF6C00),
          ),
          _Field(
            label: 'SECTOR',
            value: order.sector,
            icon: Icons.warehouse_outlined,
            color: const Color(0xFFEF6C00),
          ),
          _Field(label: 'SUMINISTRO', value: order.supplyCode),
          _Field(
            label: 'COD RUTA VECINO CIJP',
            value: order.neighborRouteCode,
          ),
          _Field(
            label: 'CENTRO_ATENCION',
            value: order.attentionCenter,
          ),
          _Field(
            label: 'SI/NO',
            value: order.registeredFlagLabel,
            color: order.registeredFlagLabel == 'SI'
                ? const Color(0xFF2E7D32)
                : const Color(0xFFC62828),
          ),
          _Field(
            label: 'ESTADO OT CIJP',
            value: order.statusLabel,
            icon: order.isProgrammed
                ? Icons.play_circle_filled_rounded
                : Icons.cancel_outlined,
            color: order.isProgrammed
                ? const Color(0xFF2E7D32)
                : const Color(0xFF607080),
          ),
          _Field(label: 'OBS DE EJEC', value: order.executionNotes),
          _Field(
            label: 'TECNICO1 CIJP',
            value: order.technicianName,
            icon: Icons.people_alt_rounded,
            color: const Color(0xFF1565C0),
          ),
          _Field(
            label: 'FECHA PROG CIJP',
            value: order.scheduledDateLabel,
            color: const Color(0xFFC62828),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.value,
    this.icon,
    this.color,
  });

  final String label;
  final String value;
  final IconData? icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: Color(0xFF8A93A3),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: color ?? const Color(0xFF5C6778)),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Text(
                  value.trim().isEmpty ? ' ' : value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: color ?? Theme.of(context).colorScheme.onSurface,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
