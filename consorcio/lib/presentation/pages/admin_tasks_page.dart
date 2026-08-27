import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/field_task.dart';
import '../../domain/errors/domain_exception.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'assign_task_page.dart';

class AdminTasksPage extends StatefulWidget {
  const AdminTasksPage({super.key});

  @override
  State<AdminTasksPage> createState() => _AdminTasksPageState();
}

class _AdminTasksPageState extends State<AdminTasksPage> {
  List<FieldTask> _tasks = [];
  bool _loading = true;
  String? _error;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  List<FieldTask> get _filtered {
    if (_filter == 'all') return _tasks;
    return _tasks.where((item) => item.status == _filter).toList();
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
      final tasks = await deps.listManagedTasksUseCase.execute(user);
      if (!mounted) return;
      setState(() {
        _tasks = tasks;
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
        _error = 'No se pudieron cargar las tareas';
        _loading = false;
      });
    }
  }

  Future<void> _openAssign() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AssignTaskPage()),
    );
    if (created == true && mounted) {
      await _load();
    }
  }

  String _dueLabel(DateTime? date) {
    if (date == null) return 'Sin fecha límite';
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    return 'Límite $day/$month/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final filtered = _filtered;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tareas'),
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
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAssign,
        icon: const Icon(Icons.add_task_rounded),
        label: const Text('Asignar'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1565C0), Color(0xFF2E7D32)],
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Asigna el trabajo',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Crea tareas para los técnicos: actividad, suministro y responsables.',
                    style: TextStyle(color: Colors.white, height: 1.35),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _FilterChip(
                  label: 'Todas',
                  selected: _filter == 'all',
                  onTap: () => setState(() => _filter = 'all'),
                ),
                _FilterChip(
                  label: 'Pendientes',
                  selected: _filter == 'PENDIENTE',
                  onTap: () => setState(() => _filter = 'PENDIENTE'),
                ),
                _FilterChip(
                  label: 'En progreso',
                  selected: _filter == 'EN_PROGRESO',
                  onTap: () => setState(() => _filter = 'EN_PROGRESO'),
                ),
                _FilterChip(
                  label: 'Hechas',
                  selected: _filter == 'COMPLETADA',
                  onTap: () => setState(() => _filter = 'COMPLETADA'),
                ),
              ],
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
                child: Column(
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Reintentar'),
                    ),
                  ],
                ),
              )
            else if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Text(
                  _tasks.isEmpty
                      ? 'Aún no hay tareas. Toca Asignar para crear la primera.'
                      : 'No hay tareas en este filtro.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.mutedOf(context)),
                ),
              )
            else
              ...filtered.map((task) {
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.statusBackground(
                                  context,
                                  task.status,
                                ),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                task.statusLabel,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.statusForeground(
                                    context,
                                    task.status,
                                  ),
                                ),
                              ),
                            ),
                            const Spacer(),
                            Flexible(
                              child: Text(
                                task.assigneesLabel,
                                textAlign: TextAlign.right,
                                style: TextStyle(
                                  color: AppTheme.mutedOf(context),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          task.title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (task.description.trim().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(task.description),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          [
                            if (task.areaName.isNotEmpty) task.areaName,
                            task.routesLabel,
                            _dueLabel(task.dueDate),
                          ].join(' · '),
                          style: TextStyle(
                            color: AppTheme.mutedOf(context),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }
}
