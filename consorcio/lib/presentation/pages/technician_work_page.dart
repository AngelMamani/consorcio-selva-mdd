import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/folder_date.dart';
import '../../domain/entities/technician_activity_work.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/services/supply_search_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'folder_date_detail_page.dart';

class TechnicianWorkPage extends StatefulWidget {
  const TechnicianWorkPage({
    super.key,
    required this.areaId,
    required this.areaName,
    required this.technician,
  });

  final String areaId;
  final String areaName;
  final ActivityTechnicianFolder technician;

  @override
  State<TechnicianWorkPage> createState() => _TechnicianWorkPageState();
}

class _TechnicianWorkPageState extends State<TechnicianWorkPage> {
  List<PublishedTechnicianWork> _works = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  String _label(PublishedTechnicianWork work) {
    final route = work.routeCode.isNotEmpty
        ? formatRouteCode(work.routeCode)
        : work.folderName;
    final date = FolderDate(
      id: work.dateId,
      folderId: work.folderId,
      dateKey: work.dateKey,
      note: '',
      imageCount: work.imageCount,
      createdById: '',
      createdByName: '',
      createdAt: work.publishedAt,
      updatedAt: work.publishedAt,
    );
    return '$route · ${date.formattedLabel}';
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
        _works = result.works
            .where(
              (work) => work.technicianId == widget.technician.technicianId,
            )
            .toList();
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
        _error = 'No se pudieron cargar los trabajos publicados';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.technician.technicianName)),
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
                  const Text(
                    'Trabajos publicados',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Dentro de ${widget.areaName}: cada carpeta es la ruta más la fecha. Entra para ver las fotos.',
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
            else if (_works.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text(
                  'Este técnico aún no ha publicado fotos en esta actividad.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              ..._works.map(
                (work) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: const CircleAvatar(
                      child: Icon(Icons.folder_rounded),
                    ),
                    title: Text(
                      _label(work),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      'Publicada · ${work.imageCount} foto(s)',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => FolderDateDetailPage(
                            folderId: work.folderId,
                            dateId: work.dateId,
                            technicianId: work.technicianId,
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
