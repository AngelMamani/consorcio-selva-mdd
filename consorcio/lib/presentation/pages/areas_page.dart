import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/area.dart';
import '../../domain/errors/domain_exception.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import '../../domain/value_objects/user_role.dart';
import 'activity_technicians_page.dart';
import 'folders_page.dart';
import 'installation_orders_page.dart';

class AreasPage extends StatefulWidget {
  const AreasPage({super.key});

  @override
  State<AreasPage> createState() => _AreasPageState();
}

class _AreasPageState extends State<AreasPage> {
  List<Area> _areas = [];
  bool _loading = true;
  String? _error;

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
      final areas = await deps.listAreasUseCase.execute(user);
      if (!mounted) return;
      setState(() {
        _areas = areas;
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
        _error = 'No se pudieron cargar las actividades';
        _loading = false;
      });
    }
  }

  Future<void> _openArea(Area area) async {
    if (area.isWorkOrders) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => InstallationOrdersPage(
            areaId: area.id,
            areaName: area.name,
          ),
        ),
      );
      return;
    }
    final session = context.read<SessionController>();
    final isAdmin = session.user?.role == UserRole.administrador;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => isAdmin
            ? ActivityTechniciansPage(areaId: area.id, areaName: area.name)
            : FoldersPage(areaId: area.id, areaName: area.name),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Actividades'),
        actions: [
          IconButton(
            tooltip: session.isDarkTheme ? 'Modo claro' : 'Modo oscuro',
            onPressed: session.themeBusy
                ? null
                : () async {
                    final ok = await session.toggleTheme();
                    if (!ok &&
                        context.mounted &&
                        session.errorMessage != null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(session.errorMessage!)),
                      );
                    }
                  },
            icon: Icon(
              session.isDarkTheme
                  ? Icons.light_mode_rounded
                  : Icons.dark_mode_rounded,
            ),
          ),
          IconButton(
            tooltip: 'Cerrar sesión',
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Cerrar sesión'),
                  content: const Text('¿Salir de la app de técnicos?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Cancelar'),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('Salir'),
                    ),
                  ],
                ),
              );
              if (confirm == true && context.mounted) {
                await context.read<SessionController>().logout();
              }
            },
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    session.user?.role == UserRole.administrador
                        ? 'Elige una actividad'
                        : 'Elige un área',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    session.user?.role == UserRole.administrador
                        ? 'Dentro verás la carpeta de cada técnico y sus trabajos publicados.'
                        : 'Dentro ves solo las fotos que tú subes.',
                    style: const TextStyle(color: Colors.white),
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
            else if (_areas.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text(
                  'Aún no hay actividades. Un administrador debe crearlas en el panel web.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              ..._areas.map(
                (area) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: const CircleAvatar(
                      child: Icon(Icons.layers_rounded),
                    ),
                    title: Text(
                      area.name,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      [
                        area.isWorkOrders
                            ? 'Órdenes de trabajo'
                            : (area.description.trim().isEmpty
                                ? 'Sin descripción'
                                : area.description),
                      ].join(),
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => _openArea(area),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
