import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/attendance.dart';
import '../../domain/entities/attendance_permission_request.dart';
import '../../domain/entities/attendance_settings.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../../domain/usecases/attendance_permission_request_use_cases.dart';
import '../services/device_location_service.dart';
import '../services/image_picker_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import '../widgets/technician_alert.dart';

enum _MarkPhotoChoice { withPhoto, withoutPhoto }

class AttendancePage extends StatefulWidget {
  const AttendancePage({super.key});

  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage> {
  final _locationService = DeviceLocationService();
  final _photoService = ImagePickerService();
  Attendance? _today;
  AttendanceSettings? _settings;
  List<AttendancePermissionRequest> _myRequests = const [];
  bool _loading = true;
  bool _marking = false;
  bool _requesting = false;
  String _markingLabel = 'Obteniendo GPS...';
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
    if (user == null) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Sesión no lista. Toca actualizar.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        deps.getMyTodayAttendanceUseCase.execute(user),
        deps.getAttendanceSettingsUseCase.execute(user),
      ]);
      if (!mounted) return;
      setState(() {
        _today = results[0] as Attendance?;
        _settings = results[1] as AttendanceSettings;
        _loading = false;
      });

      try {
        final requests =
            await deps.listMyAttendancePermissionRequestsUseCase.execute(user);
        if (!mounted) return;
        setState(() {
          _myRequests = requests.take(6).toList();
        });
      } catch (_) {}
    } on DomainException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
      await _showAlert(
        TechnicianAlertKind.error,
        'No se pudo cargar',
        error.message,
      );
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().contains('permission-denied')
          ? 'No tienes permiso para ver asistencias'
          : 'No se pudo cargar la asistencia. Revisa tu conexión.';
      setState(() {
        _error = message;
        _loading = false;
      });
      await _showAlert(
        TechnicianAlertKind.error,
        'No se pudo cargar',
        message,
      );
    }
  }

  Future<void> _markOffice() async {
    await _mark(AttendanceOrigin.oficina);
  }

  Future<void> _markZone() async {
    await _mark(AttendanceOrigin.zona);
  }

  Future<void> _mark(AttendanceOrigin origin) async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    if (!mounted) return;
    final confirm = await _confirmMark(origin);
    if (confirm == null || !mounted) return;

    setState(() {
      _marking = true;
      _markingLabel = 'Obteniendo GPS...';
    });
    try {
      // GPS fresco al confirmar (no usar ubicación vieja del share).
      final location = await _locationService.getCurrentLocation(
        purpose: 'marcar asistencia',
        preferQuick: false,
      );

      if (origin == AttendanceOrigin.oficina) {
        final settings = _settings ?? AttendanceSettings.defaults;
        final match = settings.findMatchingOfficePoint(location);
        if (match == null) {
          throw DomainException(
            'No estás dentro del radio de un punto de oficina autorizado.',
          );
        }
      }

      if (!mounted) return;

      ImageFilePayload? photo;
      if (confirm == _MarkPhotoChoice.withPhoto) {
        setState(() {
          _markingLabel = 'Tomando foto de uniforme...';
        });
        photo = await _photoService.takeAttendancePhoto();
        if (!mounted) return;
      }

      setState(() {
        _markingLabel = photo != null
            ? 'Subiendo foto y asistencia...'
            : 'Registrando asistencia...';
      });

      final attendance = await deps.markAttendanceUseCase.execute(
        user,
        origin: origin,
        location: location,
        environmentPhoto: photo,
      );
      if (!mounted) return;
      setState(() {
        _today = attendance;
        _marking = false;
      });
      final place = origin == AttendanceOrigin.oficina
          ? (attendance.areaName.isNotEmpty
              ? 'en ${attendance.areaName}'
              : 'en oficina')
          : 'en campo';
      final photoNote =
          photo != null ? ' con foto de uniforme' : ' (sin foto)';
      await _showAlert(
        TechnicianAlertKind.success,
        'Asistencia marcada',
        'Quedó $place a las ${_formatTime(attendance.createdAt)}$photoNote. '
        'Ya no puedes volver a marcar hoy.',
      );
    } on DomainException catch (error) {
      if (!mounted) return;
      setState(() => _marking = false);
      await _showAlert(
        TechnicianAlertKind.error,
        'No se pudo marcar',
        error.message,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _marking = false);
      await _showAlert(
        TechnicianAlertKind.error,
        'No se pudo marcar',
        'Revisa el GPS y tu conexión. Luego intenta de nuevo.',
      );
    }
  }

  Future<_MarkPhotoChoice?> _confirmMark(AttendanceOrigin origin) async {
    final isField = origin == AttendanceOrigin.zona;
    return showModalBottomSheet<_MarkPhotoChoice>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  isField
                      ? 'Marcar asistencia en campo'
                      : 'Confirmar asistencia en oficina',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'La foto de uniforme es opcional. Puedes marcar solo con GPS '
                  'o agregar una foto de cuerpo completo.',
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () =>
                      Navigator.pop(context, _MarkPhotoChoice.withPhoto),
                  icon: const Icon(Icons.photo_camera_rounded),
                  label: const Text('Tomar foto y marcar'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () =>
                      Navigator.pop(context, _MarkPhotoChoice.withoutPhoto),
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Marcar sin foto'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancelar'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _requestPermission() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null || _requesting) return;

    final descriptionController = TextEditingController();
    ImageFilePayload? photo;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: StatefulBuilder(
            builder: (context, setModalState) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Solicitar permiso',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Describe el motivo. El administrador revisará y asignará '
                    'los días. La foto es opcional.',
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: descriptionController,
                    maxLength: maxPermissionDescription,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Descripción',
                      hintText: 'Ej. Cita médica el jueves y viernes...',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final taken = await _photoService.takePhoto();
                      if (taken == null) return;
                      setModalState(() => photo = taken);
                    },
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: Text(
                      photo == null
                          ? 'Agregar foto (opcional)'
                          : 'Foto lista · cambiar',
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () {
                      final text = descriptionController.text.trim();
                      if (text.length < minPermissionDescription) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Describe el motivo con al menos 8 caracteres',
                            ),
                          ),
                        );
                        return;
                      }
                      Navigator.pop(context, true);
                    },
                    child: const Text('Enviar solicitud'),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: const Text('Cancelar'),
                  ),
                ],
              );
            },
          ),
        );
      },
    );

    final description = descriptionController.text;
    if (confirmed != true || !mounted) {
      // Después del frame: el TextField del sheet ya se desmontó.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        descriptionController.dispose();
      });
      return;
    }

    setState(() => _requesting = true);
    try {
      await deps.requestAttendancePermissionUseCase
          .execute(
            user,
            description: description,
            evidencePhoto: photo,
          )
          .timeout(const Duration(seconds: 12));
      if (!mounted) return;
      setState(() => _requesting = false);
      await _showAlert(
        TechnicianAlertKind.success,
        'Solicitud enviada',
        'El administrador revisará tu solicitud y asignará los días de permiso.',
      );
      if (mounted) await _load();
    } on DomainException catch (error) {
      if (!mounted) return;
      setState(() => _requesting = false);
      await _showAlert(
        TechnicianAlertKind.error,
        'No se pudo enviar',
        error.message,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _requesting = false);
      await _showAlert(
        TechnicianAlertKind.error,
        'No se pudo enviar',
        'Revisa tu conexión e intenta de nuevo.',
      );
    } finally {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        descriptionController.dispose();
      });
      if (mounted && _requesting) setState(() => _requesting = false);
    }
  }

  Future<void> _showAlert(
    TechnicianAlertKind kind,
    String title,
    String message,
  ) {
    if (!mounted) return Future.value();
    return showTechnicianAlert(
      context,
      kind: kind,
      title: title,
      message: message,
    );
  }

  String _formatDateLabel(String dateKey) {
    final parts = dateKey.split('-');
    if (parts.length != 3) return 'Hoy';
    return 'Hoy · ${parts[2]}/${parts[1]}/${parts[0]}';
  }

  String _formatTime(DateTime date) {
    final lima = date.toUtc().subtract(const Duration(hours: 5));
    final hour = lima.hour.toString().padLeft(2, '0');
    final minute = lima.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    final settings = _settings ?? AttendanceSettings.defaults;
    final dateLabel = limaDateKey();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Asistencia'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            onPressed: _loading || _marking || _requesting ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
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
                        'Marca de hoy',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _formatDateLabel(dateLabel),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${settings.resolvedOfficePoints.map((point) => point.name).join(' · ')} · '
                        'Oficina o campo con GPS. Foto de uniforme opcional. Puedes solicitar permiso.',
                        style: const TextStyle(color: Colors.white70, height: 1.35),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.only(top: 48),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 24),
                    child: Text(_error!, textAlign: TextAlign.center),
                  )
                else ...[
                  if (_today != null)
                    _MarkedCard(
                      attendance: _today!,
                      timeLabel: _formatTime(_today!.createdAt),
                    )
                  else ...[
                    _ActionCard(
                      color: AppTheme.isDarkOf(context)
                          ? const Color(0xFF7EC8FF)
                          : const Color(0xFF1565C0),
                      icon: Icons.apartment_rounded,
                      title: 'Estoy en oficina',
                      subtitle: 'GPS requerido. Foto de uniforme opcional.',
                      onTap: _marking || _requesting ? null : _markOffice,
                    ),
                    const SizedBox(height: 12),
                    _ActionCard(
                      color: AppTheme.isDarkOf(context)
                          ? const Color(0xFF8BE09A)
                          : const Color(0xFF2E7D32),
                      icon: Icons.terrain_rounded,
                      title: 'Estoy en campo',
                      subtitle: 'GPS requerido. Foto de uniforme opcional.',
                      onTap: _marking || _requesting ? null : _markZone,
                    ),
                  ],
                  const SizedBox(height: 12),
                  _ActionCard(
                    color: AppTheme.isDarkOf(context)
                        ? const Color(0xFFE0B0FF)
                        : const Color(0xFF6A1B9A),
                    icon: Icons.event_busy_rounded,
                    title: 'Solicitar permiso',
                    subtitle:
                        'Describe el motivo. Foto opcional. El admin asigna los días.',
                    onTap: _marking || _requesting ? null : _requestPermission,
                  ),
                  if (_myRequests.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text(
                      'Mis solicitudes',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ..._myRequests.map(
                      (item) => Card(
                        child: ListTile(
                          title: Text(
                            AttendancePermissionRequestStatus.label(
                              item.status,
                            ),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(
                            [
                              item.description,
                              if (item.leaveDays != null)
                                '${item.leaveDays} día(s)'
                                    '${item.startDateKey != null ? ' · ${item.startDateKey}' : ''}'
                                    '${item.endDateKey != null && item.endDateKey != item.startDateKey ? ' → ${item.endDateKey}' : ''}',
                            ].join('\n'),
                          ),
                          isThreeLine: true,
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
          if (_marking || _requesting)
            ColoredBox(
              color: const Color(0x66000000),
              child: Center(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircularProgressIndicator(),
                        const SizedBox(height: 12),
                        Text(
                          _requesting ? 'Enviando solicitud...' : _markingLabel,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MarkedCard extends StatelessWidget {
  const _MarkedCard({
    required this.attendance,
    required this.timeLabel,
  });

  final Attendance attendance;
  final String timeLabel;

  @override
  Widget build(BuildContext context) {
    final isOffice = attendance.origin == AttendanceOrigin.oficina;
    final isPermiso = attendance.origin == AttendanceOrigin.permiso;
    final officeColor = AppTheme.isDarkOf(context)
        ? const Color(0xFF7EC8FF)
        : const Color(0xFF1565C0);
    final fieldColor = AppTheme.isDarkOf(context)
        ? const Color(0xFF8BE09A)
        : const Color(0xFF2E7D32);
    final permisoColor = AppTheme.isDarkOf(context)
        ? const Color(0xFFE0B0FF)
        : const Color(0xFF6A1B9A);
    final accent = isPermiso
        ? permisoColor
        : isOffice
            ? officeColor
            : fieldColor;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: accent.withValues(alpha: 0.18),
                  foregroundColor: accent,
                  child: Icon(
                    isPermiso
                        ? Icons.event_busy_rounded
                        : isOffice
                            ? Icons.apartment_rounded
                            : Icons.terrain_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        attendance.origin.label,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        isPermiso
                            ? 'Registrado a las $timeLabel'
                            : 'Marcada a las $timeLabel',
                      ),
                    ],
                  ),
                ),
                Icon(Icons.check_circle_rounded, color: fieldColor),
              ],
            ),
            if (attendance.permissionNote != null &&
                attendance.permissionNote!.trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(attendance.permissionNote!.trim()),
            ],
            if (attendance.origin == AttendanceOrigin.oficina) ...[
              const SizedBox(height: 6),
              const Text('Ubicación validada dentro de la oficina'),
            ],
            if (!isPermiso) ...[
              const SizedBox(height: 6),
              Text(
                'GPS: ${attendance.location.latitude.toStringAsFixed(5)}, '
                '${attendance.location.longitude.toStringAsFixed(5)}',
              ),
            ],
            if (attendance.environmentPhotoUrl != null &&
                attendance.environmentPhotoUrl!.isNotEmpty) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  attendance.environmentPhotoUrl!,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.color,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final Color color;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: color.withValues(alpha: 0.14),
                foregroundColor: color,
                child: Icon(icon),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(subtitle),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: color),
            ],
          ),
        ),
      ),
    );
  }
}
