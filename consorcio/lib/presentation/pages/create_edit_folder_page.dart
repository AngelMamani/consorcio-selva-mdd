import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/app_user.dart';
import '../../domain/entities/image_folder.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/value_objects/geo_location.dart';
import '../services/device_location_service.dart';
import '../state/session_controller.dart';

enum _AssignMode { self, all, specific }

class CreateEditFolderPage extends StatefulWidget {
  const CreateEditFolderPage({
    super.key,
    this.folder,
    this.areaId,
    this.areaName,
  });

  final ImageFolder? folder;
  final String? areaId;
  final String? areaName;

  @override
  State<CreateEditFolderPage> createState() => _CreateEditFolderPageState();
}

class _CreateEditFolderPageState extends State<CreateEditFolderPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _locationService = DeviceLocationService();

  final Set<String> _selectedTechnicianIds = {};
  List<AppUser> _technicians = [];
  _AssignMode _assignMode = _AssignMode.self;
  GeoLocation? _capturedLocation;
  bool _saving = false;
  bool _loadingTechnicians = true;
  String _status = '';

  bool get _isEdit => widget.folder != null;

  @override
  void initState() {
    super.initState();
    final folder = widget.folder;
    if (folder != null) {
      _nameController.text = folder.name;
      _descriptionController.text = folder.description;
      _capturedLocation = folder.location;
      if (folder.assignToAllTechnicians) {
        _assignMode = _AssignMode.all;
      } else {
        _assignMode = _AssignMode.specific;
        _selectedTechnicianIds.addAll(folder.assignedTechnicianIds);
        if (_selectedTechnicianIds.isEmpty && folder.ownerId.isNotEmpty) {
          _selectedTechnicianIds.add(folder.ownerId);
        }
        // Si solo está el dueño, se muestra como "Solo yo" al cargar sesión.
      }
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final selfId = context.read<SessionController>().user?.id;
      if (widget.folder == null && selfId != null) {
        setState(() {
          _assignMode = _AssignMode.self;
          _selectedTechnicianIds
            ..clear()
            ..add(selfId);
        });
      } else if (widget.folder != null &&
          !widget.folder!.assignToAllTechnicians &&
          selfId != null &&
          _selectedTechnicianIds.length == 1 &&
          _selectedTechnicianIds.contains(selfId)) {
        setState(() => _assignMode = _AssignMode.self);
      }
      _loadTechnicians();
    });
  }

  Future<void> _loadTechnicians() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    try {
      final technicians =
          await deps.createFolderUseCase.listTechniciansForAssignment();
      if (!mounted) return;
      setState(() {
        _technicians = technicians;
        _loadingTechnicians = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingTechnicians = false);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  ({bool assignAll, List<String> ids}) _assignmentPayload(AppUser actor) {
    switch (_assignMode) {
      case _AssignMode.all:
        return (assignAll: true, ids: <String>[]);
      case _AssignMode.self:
        return (assignAll: false, ids: <String>[actor.id]);
      case _AssignMode.specific:
        final ids = _selectedTechnicianIds.toList();
        if (!ids.contains(actor.id)) ids.add(actor.id);
        return (assignAll: false, ids: ids);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    if (_assignMode == _AssignMode.specific &&
        _selectedTechnicianIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona al menos un técnico')),
      );
      return;
    }

    setState(() {
      _saving = true;
      _status = _isEdit ? 'Guardando...' : 'Obteniendo GPS...';
    });

    try {
      final assignment = _assignmentPayload(user);
      late ImageFolder folder;
      if (_isEdit) {
        folder = await deps.updateFolderUseCase.execute(
          user,
          folderId: widget.folder!.id,
          name: _nameController.text,
          description: _descriptionController.text,
          assignToAllTechnicians: assignment.assignAll,
          assignedTechnicianIds: assignment.ids,
        );

        if (!folder.hasLocation) {
          setState(() => _status = 'Obteniendo GPS...');
          final location = await _locationService.getCurrentLocation();
          if (!mounted) return;
          setState(() {
            _capturedLocation = location;
            _status = 'Asignando ubicación...';
          });
          folder = await deps.assignFolderLocationUseCase.execute(
            user,
            folderId: folder.id,
            location: location,
          );
        }
      } else {
        final location = await _locationService.getCurrentLocation();
        if (!mounted) return;
        setState(() {
          _capturedLocation = location;
          _status = 'Creando carpeta...';
        });

        folder = await deps.createFolderUseCase.execute(
          user,
          areaId: widget.areaId ?? widget.folder?.areaId ?? '',
          name: _nameController.text,
          description: _descriptionController.text,
          location: location,
          assignToAllTechnicians: assignment.assignAll,
          assignedTechnicianIds: assignment.ids,
        );
      }

      if (!mounted) return;
      if (_isEdit) {
        Navigator.pop(context, true);
      } else {
        Navigator.pop(context, folder.id);
      }
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo guardar la carpeta')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _status = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final location = _capturedLocation;
    final selfId = context.watch<SessionController>().user?.id;

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Editar carpeta' : 'Nueva carpeta'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            TextFormField(
              controller: _nameController,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Nombre de la carpeta',
                hintText: 'Ej: Trabajo sector 3',
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Ponle un nombre claro';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _descriptionController,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Descripción (opcional)',
                hintText: 'Detalle breve del trabajo',
              ),
            ),
            const SizedBox(height: 18),
            _AssignmentSection(
              assignMode: _assignMode,
              technicians: _technicians,
              selectedIds: _selectedTechnicianIds,
              loadingTechnicians: _loadingTechnicians,
              selfId: selfId,
              enabled: !_saving,
              onModeChanged: (mode) {
                setState(() {
                  _assignMode = mode;
                  if (mode == _AssignMode.self && selfId != null) {
                    _selectedTechnicianIds
                      ..clear()
                      ..add(selfId);
                  } else if (mode == _AssignMode.specific &&
                      _selectedTechnicianIds.isEmpty &&
                      selfId != null) {
                    _selectedTechnicianIds.add(selfId);
                  }
                });
              },
              onToggleTechnician: (id, checked) {
                setState(() {
                  if (checked) {
                    _selectedTechnicianIds.add(id);
                  } else {
                    _selectedTechnicianIds.remove(id);
                  }
                });
              },
            ),
            const SizedBox(height: 18),
            Builder(
              builder: (context) {
                final isDark = Theme.of(context).brightness == Brightness.dark;
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF1F3A2C)
                        : const Color(0xFFF0F7F2),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isDark
                          ? const Color(0xFF2F5A40)
                          : const Color(0xFFC8E0D0),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.location_on_rounded,
                        color: isDark
                            ? const Color(0xFF81C784)
                            : const Color(0xFF1B7A4B),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
            Text(
                              _isEdit
                                  ? (widget.folder?.hasLocation == true
                                      ? 'Ubicación de la carpeta'
                                      : 'GPS obligatorio (sin ubicación)')
                                  : 'GPS obligatorio al crear',
                              style: const TextStyle(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _isEdit
                                  ? (location != null
                                      ? '${location.latitude.toStringAsFixed(5)}, ${location.longitude.toStringAsFixed(5)}'
                                      : 'Esta carpeta no tiene GPS. Al guardar se pedirá activarlo.')
                                  : 'Al crear, capturaremos tu ubicación actual. Mantén el GPS encendido.',
                              style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: _saving ? null : _save,
              child: Text(
                _saving
                    ? (_status.isEmpty ? 'Guardando...' : _status)
                    : (_isEdit ? 'Guardar cambios' : 'Crear y continuar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  if (parts.isEmpty) return '?';
  final list = parts.toList();
  if (list.length == 1) {
    return list.first.substring(0, list.first.length >= 2 ? 2 : 1).toUpperCase();
  }
  return '${list[0][0]}${list[1][0]}'.toUpperCase();
}

class _AssignmentSection extends StatelessWidget {
  const _AssignmentSection({
    required this.assignMode,
    required this.technicians,
    required this.selectedIds,
    required this.loadingTechnicians,
    required this.selfId,
    required this.enabled,
    required this.onModeChanged,
    required this.onToggleTechnician,
  });

  final _AssignMode assignMode;
  final List<AppUser> technicians;
  final Set<String> selectedIds;
  final bool loadingTechnicians;
  final String? selfId;
  final bool enabled;
  final ValueChanged<_AssignMode> onModeChanged;
  final void Function(String id, bool checked) onToggleTechnician;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final countLabel = assignMode == _AssignMode.all
        ? 'Todos'
        : assignMode == _AssignMode.self
            ? '1 seleccionado'
            : '${selectedIds.length} seleccionado${selectedIds.length == 1 ? '' : 's'}';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? const Color(0xFF2A3A4D) : const Color(0xFFD7DEE8),
        ),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [Color(0xFF1A2736), Color(0xFF17231F)]
              : const [Color(0xFFEAF3FB), Color(0xFFF3FAF4)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Asignación',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Quién podrá ver y trabajar esta carpeta',
                      style: TextStyle(fontSize: 12.5, color: Color(0xFF6B7385)),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0xFF243044)
                      : const Color(0xFFE3F2FD),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  countLabel,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: isDark
                        ? const Color(0xFF90CAF9)
                        : const Color(0xFF1565C0),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _ModeCard(
            selected: assignMode == _AssignMode.self,
            icon: Icons.person_rounded,
            title: 'Solo yo',
            subtitle: 'Acceso personal',
            enabled: enabled,
            onTap: () => onModeChanged(_AssignMode.self),
          ),
          const SizedBox(height: 8),
          _ModeCard(
            selected: assignMode == _AssignMode.all,
            icon: Icons.groups_rounded,
            title: 'Todos los técnicos',
            subtitle: 'Acceso general al equipo',
            enabled: enabled,
            onTap: () => onModeChanged(_AssignMode.all),
          ),
          const SizedBox(height: 8),
          _ModeCard(
            selected: assignMode == _AssignMode.specific,
            icon: Icons.person_search_rounded,
            title: 'Elegir técnicos',
            subtitle: 'Uno o varios específicos',
            enabled: enabled,
            onTap: () => onModeChanged(_AssignMode.specific),
          ),
          if (assignMode == _AssignMode.specific) ...[
            const SizedBox(height: 12),
            if (loadingTechnicians)
              const Padding(
                padding: EdgeInsets.all(12),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (technicians.isEmpty)
              const Text(
                'No hay técnicos activos para asignar.',
                style: TextStyle(color: Color(0xFF6B7385)),
              )
            else
              ...technicians.map((tech) {
                final selected = selectedIds.contains(tech.id);
                final isYou = tech.id == selfId;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Material(
                    color: selected
                        ? (isDark
                            ? const Color(0xFF1F3A2C)
                            : const Color(0xFFE8F5E9))
                        : (isDark
                            ? const Color(0xFF1C2533)
                            : Colors.white),
                    borderRadius: BorderRadius.circular(14),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: enabled
                          ? () => onToggleTechnician(tech.id, !selected)
                          : null,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: selected
                                ? (isDark
                                    ? const Color(0xFF4CAF50)
                                    : const Color(0xFF81C784))
                                : (isDark
                                    ? const Color(0xFF2A3A4D)
                                    : const Color(0xFFD9DEE8)),
                          ),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: selected
                                  ? const Color(0xFF43A047)
                                  : (isDark
                                      ? const Color(0xFF243044)
                                      : const Color(0xFFE3F2FD)),
                              foregroundColor: selected
                                  ? Colors.white
                                  : (isDark
                                      ? const Color(0xFF90CAF9)
                                      : const Color(0xFF1565C0)),
                              child: Text(
                                _initials(tech.displayName),
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    tech.displayName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    isYou ? 'Tú' : 'Técnico',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Icon(
                              selected
                                  ? Icons.check_circle_rounded
                                  : Icons.circle_outlined,
                              color: selected
                                  ? const Color(0xFF43A047)
                                  : const Color(0xFF9AA7B8),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }),
          ],
          if (assignMode == _AssignMode.all) ...[
            const SizedBox(height: 10),
            Text(
              'Esta carpeta quedará visible para todos los técnicos activos.',
              style: TextStyle(
                fontSize: 12.5,
                height: 1.35,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.enabled,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: selected
          ? (isDark ? const Color(0xFF1A2F45) : const Color(0xFFE3F2FD))
          : (isDark ? const Color(0xFF1C2533) : Colors.white),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: enabled ? onTap : null,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? (isDark ? const Color(0xFF64B5F6) : const Color(0xFF90CAF9))
                  : (isDark ? const Color(0xFF2A3A4D) : const Color(0xFFD9DEE8)),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: selected
                      ? const Color(0xFF1E88E5)
                      : (isDark
                          ? const Color(0xFF243044)
                          : const Color(0xFFEEF3F8)),
                ),
                child: Icon(
                  icon,
                  size: 20,
                  color: selected
                      ? Colors.white
                      : (isDark
                          ? const Color(0xFF90CAF9)
                          : const Color(0xFF1565C0)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                selected ? Icons.check_circle_rounded : Icons.circle_outlined,
                color: selected
                    ? const Color(0xFF43A047)
                    : const Color(0xFF9AA7B8),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
