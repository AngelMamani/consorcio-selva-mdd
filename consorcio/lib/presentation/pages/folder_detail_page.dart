import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/folder_date.dart';
import '../../domain/entities/image_folder.dart';
import '../../domain/errors/domain_exception.dart';
import '../services/device_location_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import 'create_edit_folder_page.dart';
import 'folder_date_detail_page.dart';

class FolderDetailPage extends StatefulWidget {
  const FolderDetailPage({super.key, required this.folderId});

  final String folderId;

  @override
  State<FolderDetailPage> createState() => _FolderDetailPageState();
}

class _FolderDetailPageState extends State<FolderDetailPage> {
  ImageFolder? _folder;
  List<FolderDate> _dates = [];
  bool _loading = true;
  bool _assigningLocation = false;
  bool _creatingDate = false;
  bool _locationPromptShown = false;
  String? _error;
  final _locationService = DeviceLocationService();

  bool get _needsLocation => _folder != null && !_folder!.hasLocation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({bool promptIfMissingLocation = true}) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final detail =
          await deps.getFolderDetailUseCase.execute(user, widget.folderId);
      if (!mounted) return;
      setState(() {
        _folder = detail.folder;
        _dates = detail.dates;
        _loading = false;
      });

      if (promptIfMissingLocation &&
          !detail.folder.hasLocation &&
          !_locationPromptShown) {
        _locationPromptShown = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            unawaited(_promptAssignLocation());
          }
        });
      }
    } on DomainException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudo abrir la carpeta';
        _loading = false;
      });
    }
  }

  Future<void> _promptAssignLocation() async {
    if (!mounted || !_needsLocation || _assigningLocation) return;

    final go = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Ubicación obligatoria'),
        content: const Text(
          'Esta carpeta no tiene ubicación en el mapa. '
          'Activa el GPS para asignarla ahora.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Más tarde'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.my_location_rounded),
            label: const Text('Activar GPS'),
          ),
        ],
      ),
    );

    if (go == true && mounted) {
      await _assignLocation();
    }
  }

  Future<bool> _assignLocation() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return false;

    setState(() => _assigningLocation = true);

    try {
      final location = await _locationService.getCurrentLocation();
      final updated = await deps.assignFolderLocationUseCase.execute(
        user,
        folderId: widget.folderId,
        location: location,
      );
      if (!mounted) return false;
      setState(() => _folder = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ubicación asignada al mapa')),
      );
      return true;
    } on DomainException catch (error) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
      return false;
    } catch (_) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo asignar la ubicación GPS')),
      );
      return false;
    } finally {
      if (mounted) setState(() => _assigningLocation = false);
    }
  }

  Future<void> _editFolder() async {
    final folder = _folder;
    if (folder == null) return;
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreateEditFolderPage(folder: folder),
      ),
    );
    if (updated == true) await _load(promptIfMissingLocation: false);
  }

  Future<void> _openDate(FolderDate folderDate) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FolderDateDetailPage(
          folderId: widget.folderId,
          dateId: folderDate.id,
        ),
      ),
    );
    await _load(promptIfMissingLocation: false);
  }

  Future<void> _createDate() async {
    if (_creatingDate) return;
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      helpText: 'Fecha de trabajo',
      cancelText: 'Cancelar',
      confirmText: 'Continuar',
    );
    if (picked == null || !mounted) return;

    final noteController = TextEditingController();
    final note = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nueva fecha'),
        content: TextField(
          controller: noteController,
          maxLength: 200,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            labelText: 'Nota (opcional)',
            hintText: 'Ej. Inspección sector 2',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, noteController.text),
            child: const Text('Crear fecha'),
          ),
        ],
      ),
    );
    noteController.dispose();
    if (note == null || !mounted) return;

    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    setState(() => _creatingDate = true);
    try {
      final created = await deps.createFolderDateUseCase.execute(
        user,
        folderId: widget.folderId,
        dateKey: FolderDate.toDateKey(picked),
        note: note,
      );
      if (!mounted) return;
      setState(() {
        _dates = [..._dates, created]
          ..sort((a, b) => b.dateKey.compareTo(a.dateKey));
      });
      await _openDate(created);
    } on DomainException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo crear la fecha')),
      );
    } finally {
      if (mounted) setState(() => _creatingDate = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final folder = _folder;
    final busy = _assigningLocation || _creatingDate;

    return Scaffold(
      appBar: AppBar(
        title: Text(folder?.name ?? 'Carpeta'),
        actions: [
          if (folder != null)
            IconButton(
              tooltip: 'Editar',
              onPressed: busy ? null : _editFolder,
              icon: const Icon(Icons.edit_rounded),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _loading || busy ? null : _createDate,
        icon: const Icon(Icons.calendar_month_rounded),
        label: Text(_creatingDate ? 'Creando...' : 'Nueva fecha'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, textAlign: TextAlign.center),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => _load(promptIfMissingLocation: false),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    children: [
                      Text(
                        folder?.description.isNotEmpty == true
                            ? folder!.description
                            : 'Sin descripción',
                        style: const TextStyle(
                          color: Color(0xFF6B7385),
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${_dates.length} fecha(s) · ${folder?.imageCount ?? 0} foto(s)',
                        style: const TextStyle(
                          color: AppTheme.brandGreen,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (folder != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(
                              Icons.group_rounded,
                              size: 18,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Asignado: ${folder.assigneesLabel}',
                                style: TextStyle(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (_needsLocation) ...[
                        const SizedBox(height: 12),
                        _MissingLocationCard(
                          busy: _assigningLocation,
                          onAssign: _assignLocation,
                        ),
                      ] else if (folder?.hasLocation == true) ...[
                        const SizedBox(height: 8),
                        Text(
                          'GPS: ${folder!.location!.latitude.toStringAsFixed(5)}, ${folder.location!.longitude.toStringAsFixed(5)}',
                          style: const TextStyle(
                            color: Color(0xFF6B7385),
                            fontSize: 13,
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      if (_dates.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 48),
                          child: Text(
                            'Crea una fecha para subir fotos.\nLas imágenes van dentro de cada día de trabajo.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Color(0xFF6B7385)),
                          ),
                        )
                      else
                        ..._dates.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Material(
                              color: Theme.of(context).cardColor,
                              borderRadius: BorderRadius.circular(16),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(16),
                                onTap: () => _openDate(item),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 46,
                                        height: 46,
                                        decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(14),
                                          color: const Color(0xFF43A047),
                                        ),
                                        child: const Icon(
                                          Icons.calendar_month_rounded,
                                          color: Colors.white,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              item.formattedLabel,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              item.note.isEmpty
                                                  ? 'Sin nota'
                                                  : item.note,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                color: Color(0xFF6B7385),
                                                fontSize: 13,
                                              ),
                                            ),
                                            Text(
                                              '${item.imageCount} foto(s)',
                                              style: const TextStyle(
                                                fontSize: 12.5,
                                                fontWeight: FontWeight.w700,
                                                color: AppTheme.brandGreen,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const Icon(Icons.chevron_right_rounded),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }
}

class _MissingLocationCard extends StatelessWidget {
  const _MissingLocationCard({
    required this.busy,
    required this.onAssign,
  });

  final bool busy;
  final Future<bool> Function() onAssign;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF3A2A14) : const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? const Color(0xFF6D4C1D) : const Color(0xFFFFE082),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.location_off_rounded,
                color: isDark
                    ? const Color(0xFFFFCC80)
                    : const Color(0xFFEF6C00),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Sin ubicación en el mapa',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: isDark
                            ? const Color(0xFFFFE0B2)
                            : const Color(0xFFE65100),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Activa el GPS del celular para asignar la ubicación de esta carpeta.',
                      style: TextStyle(
                        height: 1.35,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: busy ? null : () => onAssign(),
              icon: busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location_rounded),
              label: Text(busy ? 'Obteniendo GPS...' : 'Activar GPS y asignar'),
            ),
          ),
        ],
      ),
    );
  }
}
