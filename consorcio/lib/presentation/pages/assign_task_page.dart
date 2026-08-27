import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/app_user.dart';
import '../../domain/entities/area.dart';
import '../../domain/entities/supply.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/usecases/search_supplies_use_case.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';

class _DraftRoute {
  const _DraftRoute({
    required this.routeCode,
    required this.note,
    required this.hasLocation,
    required this.isNew,
  });

  final String routeCode;
  final String note;
  final bool hasLocation;
  final bool isNew;
}

class AssignTaskPage extends StatefulWidget {
  const AssignTaskPage({super.key});

  @override
  State<AssignTaskPage> createState() => _AssignTaskPageState();
}

class _AssignTaskPageState extends State<AssignTaskPage> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _routeController = TextEditingController();
  final _noteController = TextEditingController();

  List<Area> _areas = [];
  List<AppUser> _technicians = [];
  final Set<String> _selectedTechnicianIds = {};
  final List<_DraftRoute> _routes = [];
  List<Supply> _suggestions = [];
  Timer? _searchTimer;
  bool _searchingRoutes = false;
  String? _areaId;
  bool _assignAll = false;
  DateTime? _dueDate;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _routeController.addListener(_onRouteQueryChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadLookups());
  }

  @override
  void dispose() {
    _searchTimer?.cancel();
    _routeController.removeListener(_onRouteQueryChanged);
    _descriptionController.dispose();
    _routeController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _loadLookups() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    try {
      final areas = await deps.listAreasUseCase.execute(user);
      final technicians = await deps.createFieldTaskUseCase.listTechnicians();
      if (!mounted) return;
      setState(() {
        _areas = areas;
        _technicians = technicians;
        _loading = false;
        if (_areaId == null && areas.isNotEmpty) {
          _areaId = areas.first.id;
        }
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
        _error = 'No se pudieron cargar actividades o técnicos';
        _loading = false;
      });
    }
  }

  Future<void> _pickDueDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 3),
    );
    if (picked == null || !mounted) return;
    setState(() => _dueDate = picked);
  }

  void _onRouteQueryChanged() {
    _searchTimer?.cancel();
    final digits = normalizeRouteCode(_routeController.text);
    if (digits.length < 3) {
      if (_suggestions.isNotEmpty || _searchingRoutes) {
        setState(() {
          _suggestions = [];
          _searchingRoutes = false;
        });
      }
      return;
    }
    setState(() => _searchingRoutes = true);
    _searchTimer = Timer(const Duration(milliseconds: 220), () {
      unawaited(_searchRoutes(digits));
    });
  }

  Future<void> _searchRoutes(String digits) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;
    try {
      final hits = await deps.searchSuppliesUseCase.execute(user, digits);
      if (!mounted) return;
      final taken = _routes.map((route) => route.routeCode).toSet();
      setState(() {
        _suggestions =
            hits.where((supply) => !taken.contains(supply.routeCode)).toList();
        _searchingRoutes = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _suggestions = [];
        _searchingRoutes = false;
      });
    }
  }

  void _pickSupply(Supply supply) {
    if (_routes.any((route) => route.routeCode == supply.routeCode)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Esa ruta ya está en la tarea')),
      );
      return;
    }
    final note = _noteController.text.trim();
    setState(() {
      _routes.add(
        _DraftRoute(
          routeCode: supply.routeCode,
          note: note.isEmpty ? supply.note : note,
          hasLocation: supply.hasLocation,
          isNew: false,
        ),
      );
      _suggestions = [];
      _searchingRoutes = false;
      _routeController.clear();
      _noteController.clear();
    });
  }

  Future<void> _addRoute() async {
    final deps = context.read<AppDependencies>();
    final code = normalizeRouteCode(_routeController.text);
    if (!isRouteCode(code)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ingresa un código de 7 a 12 dígitos'),
        ),
      );
      return;
    }
    if (_routes.any((route) => route.routeCode == code)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Esa ruta ya está en la tarea')),
      );
      return;
    }

    try {
      final lookup = await deps.createFieldTaskUseCase.lookupRoute(code);
      var note = _noteController.text.trim();
      if (!lookup.exists) {
        if (!mounted) return;
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) {
            return AlertDialog(
              title: const Text('Ruta no está en el catálogo'),
              content: const Text(
                'Se guardará sin ubicación. El técnico podrá activar el GPS en el punto.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cancelar'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Agregar'),
                ),
              ],
            );
          },
        );
        if (confirmed != true) return;
        setState(() {
          _routes.add(
            _DraftRoute(
              routeCode: code,
              note: note,
              hasLocation: false,
              isNew: true,
            ),
          );
          _routeController.clear();
          _noteController.clear();
          _suggestions = [];
          _searchingRoutes = false;
        });
        return;
      }

      setState(() {
        _routes.add(
          _DraftRoute(
            routeCode: code,
            note: note.isEmpty ? lookup.note : note,
            hasLocation: lookup.hasLocation,
            isNew: false,
          ),
        );
        _routeController.clear();
        _noteController.clear();
        _suggestions = [];
        _searchingRoutes = false;
      });
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_routes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agrega al menos una ruta')),
      );
      return;
    }
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _saving) return;

    setState(() => _saving = true);
    try {
      await deps.createFieldTaskUseCase.execute(
        user,
        description: _descriptionController.text,
        areaId: _areaId ?? '',
        routes: _routes
            .map((route) => (routeCode: route.routeCode, note: route.note))
            .toList(),
        assignToAllTechnicians: _assignAll,
        assignedTechnicianIds: _selectedTechnicianIds.toList(),
        dueDate: _dueDate,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo asignar la tarea')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = AppTheme.mutedOf(context);
    final selectedArea = _areas.where((area) => area.id == _areaId);
    final titlePreview = selectedArea.isEmpty
        ? 'elige una actividad'
        : selectedArea.first.name;

    return Scaffold(
      appBar: AppBar(title: const Text('Asignar tarea')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, textAlign: TextAlign.center),
                  ),
                )
              : Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    children: [
                      DropdownMenu<String>(
                        initialSelection: _areaId,
                        expandedInsets: EdgeInsets.zero,
                        label: const Text('Actividad'),
                        dropdownMenuEntries: _areas
                            .map(
                              (area) => DropdownMenuEntry(
                                value: area.id,
                                label: area.name,
                              ),
                            )
                            .toList(),
                        onSelected: (value) => setState(() => _areaId = value),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Título de la tarea: $titlePreview',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _descriptionController,
                        minLines: 2,
                        maxLines: 4,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: 'Descripción (opcional)',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _routeController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Buscar suministro',
                          hintText: 'Código o últimos dígitos',
                          prefixIcon: Icon(Icons.search_rounded),
                        ),
                      ),
                      if (_searchingRoutes)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: LinearProgressIndicator(minHeight: 2),
                        ),
                      if (_suggestions.isNotEmpty)
                        ..._suggestions.take(8).map(
                          (supply) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            leading: Icon(
                              supply.hasLocation
                                  ? Icons.place_rounded
                                  : Icons.place_outlined,
                            ),
                            title: Text(supply.routeCode),
                            subtitle: Text(
                              supply.hasLocation ? 'Con GPS' : 'Sin GPS',
                            ),
                            onTap: () => _pickSupply(supply),
                          ),
                        )
                      else if (!_searchingRoutes &&
                          normalizeRouteCode(_routeController.text).length >= 3)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Sin coincidencias. Puedes agregarla si es una ruta nueva.',
                            style: TextStyle(color: muted),
                          ),
                        ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _noteController,
                        decoration: const InputDecoration(
                          labelText: 'Nota de la ruta (opcional)',
                          hintText: 'Útil si la ruta aún no tiene GPS',
                        ),
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: FilledButton.tonal(
                          onPressed: _addRoute,
                          child: const Text('Agregar ruta'),
                        ),
                      ),
                      if (_routes.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Agrega una o más rutas. Si no existe, se crea sin ubicación.',
                            style: TextStyle(color: muted),
                          ),
                        )
                      else
                        ..._routes.map(
                          (route) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(route.routeCode),
                            subtitle: Text(
                              [
                                if (route.hasLocation) 'Con GPS' else 'Sin GPS',
                                if (route.isNew) 'Nueva',
                                if (route.note.isNotEmpty) route.note,
                              ].join(' · '),
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.close),
                              onPressed: () {
                                setState(() => _routes.remove(route));
                              },
                            ),
                          ),
                        ),
                      const SizedBox(height: 12),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Fecha límite'),
                        subtitle: Text(
                          _dueDate == null
                              ? 'Opcional'
                              : '${_dueDate!.day.toString().padLeft(2, '0')}/${_dueDate!.month.toString().padLeft(2, '0')}/${_dueDate!.year}',
                        ),
                        trailing: TextButton(
                          onPressed: _dueDate == null
                              ? _pickDueDate
                              : () => setState(() => _dueDate = null),
                          child: Text(_dueDate == null ? 'Elegir' : 'Quitar'),
                        ),
                        onTap: _pickDueDate,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Asignar a',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: [
                          ChoiceChip(
                            label: const Text('Todos los técnicos'),
                            selected: _assignAll,
                            onSelected: (_) {
                              setState(() {
                                _assignAll = true;
                                _selectedTechnicianIds.clear();
                              });
                            },
                          ),
                          ChoiceChip(
                            label: const Text('Elegir técnicos'),
                            selected: !_assignAll,
                            onSelected: (_) {
                              setState(() => _assignAll = false);
                            },
                          ),
                        ],
                      ),
                      if (!_assignAll) ...[
                        const SizedBox(height: 10),
                        if (_technicians.isEmpty)
                          Text(
                            'No hay técnicos activos para asignar.',
                            style: TextStyle(color: muted),
                          )
                        else
                          ..._technicians.map((tech) {
                            final selected =
                                _selectedTechnicianIds.contains(tech.id);
                            return CheckboxListTile(
                              value: selected,
                              contentPadding: EdgeInsets.zero,
                              title: Text(tech.displayName),
                              onChanged: (checked) {
                                setState(() {
                                  if (checked == true) {
                                    _selectedTechnicianIds.add(tech.id);
                                  } else {
                                    _selectedTechnicianIds.remove(tech.id);
                                  }
                                });
                              },
                            );
                          }),
                      ],
                      const SizedBox(height: 22),
                      ElevatedButton(
                        onPressed: _saving ? null : _save,
                        child: Text(_saving ? 'Guardando...' : 'Asignar tarea'),
                      ),
                    ],
                  ),
                ),
    );
  }
}
