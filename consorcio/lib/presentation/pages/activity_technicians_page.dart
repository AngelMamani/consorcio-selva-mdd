import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/technician_activity_work.dart';
import '../../domain/errors/domain_exception.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'technician_work_page.dart';

class ActivityTechniciansPage extends StatefulWidget {
  const ActivityTechniciansPage({
    super.key,
    required this.areaId,
    required this.areaName,
  });

  final String areaId;
  final String areaName;

  @override
  State<ActivityTechniciansPage> createState() =>
      _ActivityTechniciansPageState();
}

class _ActivityTechniciansPageState extends State<ActivityTechniciansPage> {
  List<ActivityTechnicianFolder> _technicians = [];
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
      final result = await deps.listActivityPublishedWorkUseCase.execute(
        user,
        widget.areaId,
      );
      if (!mounted) return;
      setState(() {
        _technicians = result.technicians;
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
        _error = 'No se pudieron cargar las carpetas de técnicos';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.areaName)),
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
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Carpeta del técnico',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Entra para ver sus trabajos publicados: ruta + fecha, y las fotos.',
                    style: TextStyle(color: Colors.white),
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
            else if (_technicians.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text(
                  'Aún no hay técnicos con carpeta en esta actividad.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              ..._technicians.map(
                (technician) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: const CircleAvatar(
                      child: Icon(Icons.folder_shared_rounded),
                    ),
                    title: Text(
                      technician.technicianName,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      technician.workCount == 0
                          ? 'Sin trabajos publicados'
                          : '${technician.workCount} trabajo(s) · ${technician.imageCount} foto(s)',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => TechnicianWorkPage(
                            areaId: widget.areaId,
                            areaName: widget.areaName,
                            technician: technician,
                          ),
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
