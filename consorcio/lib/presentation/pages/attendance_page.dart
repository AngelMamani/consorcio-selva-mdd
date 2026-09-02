import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/attendance.dart';
import '../../domain/entities/attendance_settings.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/repositories/folder_image_repository.dart';
import '../services/device_location_service.dart';
import '../services/image_picker_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import '../widgets/technician_alert.dart';

enum _MarkConfirm { cancel, markOnly, markWithPhoto }

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
  bool _loading = true;
  bool _marking = false;
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
    if (user == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final today = await deps.getMyTodayAttendanceUseCase.execute(user);
      final settings = await deps.getAttendanceSettingsUseCase.execute(user);
      if (!mounted) return;
      setState(() {
        _today = today;
        _settings = settings;
        _loading = false;
      });
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

    setState(() {
      _marking = true;
      _markingLabel = 'Obteniendo GPS...';
    });
    try {
      final location = await _locationService.getCurrentLocation(
        purpose: 'marcar asistencia',
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
      setState(() => _marking = false);
      final confirm = await _confirmMark(origin);
      if (confirm == _MarkConfirm.cancel || !mounted) return;
      if (origin == AttendanceOrigin.zona &&
          confirm == _MarkConfirm.markWithPhoto) {
        photo = await _photoService.takePhoto();
        if (!mounted) return;
      }

      setState(() {
        _marking = true;
        _markingLabel = photo == null
            ? 'Registrando asistencia...'
            : 'Subiendo foto y asistencia...';
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
      final extra = origin == AttendanceOrigin.oficina
          ? attendance.areaName.isNotEmpty
              ? 'en ${attendance.areaName}'
              : 'confirmada en oficina'
          : photo == null
              ? 'con GPS de campo'
              : 'con GPS y foto de evidencia';
      await _showAlert(
        TechnicianAlertKind.success,
        'Asistencia marcada',
        'Quedó $extra a las ${_formatTime(attendance.createdAt)}. '
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

  Future<_MarkConfirm> _confirmMark(AttendanceOrigin origin) async {
    final isField = origin == AttendanceOrigin.zona;
    final result = await showModalBottomSheet<_MarkConfirm>(
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
                const SizedBox(height: 16),
                if (isField) ...[
                  FilledButton.icon(
                    onPressed: () =>
                        Navigator.pop(context, _MarkConfirm.markWithPhoto),
                    icon: const Icon(Icons.photo_camera_rounded),
                    label: const Text('Adjuntar foto y marcar'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () =>
                        Navigator.pop(context, _MarkConfirm.markOnly),
                    child: const Text('Marcar solo con GPS'),
                  ),
                ] else
                  FilledButton(
                    onPressed: () =>
                        Navigator.pop(context, _MarkConfirm.markOnly),
                    child: const Text('Confirmar asistencia'),
                  ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.pop(context, _MarkConfirm.cancel),
                  child: const Text('Cancelar'),
                ),
              ],
            ),
          ),
        );
      },
    );
    return result ?? _MarkConfirm.cancel;
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
            onPressed: _loading || _marking ? null : _load,
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
                        '${settings.resolvedOfficePoints.map((point) => point.name).join(' · ')} · Oficina o campo con GPS. Permiso solo por administrador.',
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
                else if (_today != null)
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
                    subtitle: 'Marca con GPS dentro de la sede.',
                    onTap: _marking ? null : _markOffice,
                  ),
                  const SizedBox(height: 12),
                  _ActionCard(
                    color: AppTheme.isDarkOf(context)
                        ? const Color(0xFF8BE09A)
                        : const Color(0xFF2E7D32),
                    icon: Icons.terrain_rounded,
                    title: 'Estoy en campo',
                    subtitle: 'Marca con GPS. La foto es opcional.',
                    onTap: _marking ? null : _markZone,
                  ),
                ],
              ],
            ),
          ),
          if (_marking)
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
                          _markingLabel,
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
