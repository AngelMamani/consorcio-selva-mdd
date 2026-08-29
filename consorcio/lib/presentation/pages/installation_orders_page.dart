import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/installation_order.dart';
import '../../domain/errors/domain_exception.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'installation_order_detail_page.dart';

class InstallationOrdersPage extends StatefulWidget {
  const InstallationOrdersPage({
    super.key,
    required this.areaId,
    required this.areaName,
  });

  final String areaId;
  final String areaName;

  @override
  State<InstallationOrdersPage> createState() => _InstallationOrdersPageState();
}

class _InstallationOrdersPageState extends State<InstallationOrdersPage> {
  StreamSubscription<List<InstallationOrder>>? _sub;
  List<InstallationOrder> _orders = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _listen());
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _listen() {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    _sub?.cancel();
    try {
      _sub = deps.listInstallationOrdersUseCase
          .watchByArea(user, widget.areaId)
          .listen(
            (orders) {
              if (!mounted) return;
              setState(() {
                _orders = orders;
                _loading = false;
              });
            },
            onError: (Object error) {
              if (!mounted) return;
              setState(() {
                _error = error is DomainException
                    ? error.message
                    : 'No se pudieron cargar las órdenes';
                _loading = false;
              });
            },
          );
    } on DomainException catch (error) {
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.areaName)),
      body: RefreshIndicator(
        onRefresh: () async => _listen(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.brandBlue, AppTheme.brandGreen],
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Órdenes de trabajo',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Cada OT se asigna aparte: un técnico y una fecha.',
                    style: TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Text(_error!, textAlign: TextAlign.center),
              )
            else if (_orders.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text(
                  'No hay órdenes asignadas en esta actividad.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              ..._orders.map(
                (order) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: order.isProgrammed
                          ? const Color(0xFFE8F5E9)
                          : const Color(0xFFECEFF3),
                      child: Icon(
                        order.isProgrammed
                            ? Icons.play_arrow_rounded
                            : Icons.close_rounded,
                        color: order.isProgrammed
                            ? const Color(0xFF2E7D32)
                            : const Color(0xFF607080),
                      ),
                    ),
                    title: Text(
                      order.orderNumber,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                    subtitle: Text(
                      [
                        'SI/NO: ${order.registeredFlagLabel}',
                        order.applicantName,
                        order.applicantAddress,
                        if (order.scheduledDateLabel.isNotEmpty)
                          order.scheduledDateLabel,
                      ].where((item) => item.trim().isNotEmpty).join('\n'),
                    ),
                    isThreeLine: true,
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              InstallationOrderDetailPage(order: order),
                        ),
                      );
                    },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
