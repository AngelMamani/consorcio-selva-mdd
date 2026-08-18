import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../../domain/entities/area.dart';
import '../../domain/entities/attendance.dart';
import '../../domain/entities/attendance_settings.dart';
import '../../domain/errors/domain_exception.dart';
import '../../domain/services/geo_distance_service.dart';
import '../../domain/value_objects/geo_location.dart';
import '../services/device_location_service.dart';
import '../services/image_picker_service.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';
import '../widgets/technician_alert.dart';
import 'office_qr_scan_page.dart';

String _osmTileUrl(double latitude, double longitude, {int zoom = 17}) {
  final n = math.pow(2, zoom).toDouble();
  final x = ((longitude + 180) / 360 * n).floor();
  final latRad = latitude * math.pi / 180;
  final y = ((1 - math.log(math.tan(latRad) + 1 / math.cos(latRad)) / math.pi) /
          2 *
          n)
      .floor();
  return 'https://tile.openstreetmap.org/$zoom/$x/$y.png';
}

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
    final payload = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const OfficeQrScanPage()),
    );
    if (payload == null || payload.isEmpty || !mounted) return;
    await _mark(AttendanceOrigin.oficina, officeQrPayload: payload);
  }

  Future<void> _markZone() async {
    final area = await _pickArea();
    if (area == null || !mounted) return;
    await _mark(AttendanceOrigin.zona, areaId: area.id);
  }

  Future<Area?> _pickArea() async {
    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return null;

    List<Area> areas;
    try {
      areas = await deps.listAreasUseCase.execute(user);
    } on DomainException catch (error) {
      await _showAlert(
        TechnicianAlertKind.error,
        'No se pudieron cargar las áreas',
        error.message,
      );
      return null;
    } catch (_) {
      await _showAlert(
        TechnicianAlertKind.error,
        'No se pudieron cargar las áreas',
        'Revisa tu conexión e intenta de nuevo.',
      );
      return null;
    }

    if (!mounted) return null;
    if (areas.isEmpty) {
      await _showAlert(
        TechnicianAlertKind.info,
        'Aún no hay áreas',
        'Pide al administrador que las cree en el panel web.',
      );
      return null;
    }

    return showModalBottomSheet<Area>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: Text(
                  '¿A qué zona de campo vas?',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ),
              ...areas.map(
                (area) => ListTile(
                  leading: const CircleAvatar(
                    child: Icon(Icons.place_rounded),
                  ),
                  title: Text(
                    area.name,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    area.description.trim().isEmpty
                        ? 'Zona de trabajo'
                        : area.description,
                  ),
                  onTap: () => Navigator.pop(context, area),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _mark(
    AttendanceOrigin origin, {
    String? areaId,
    String? officeQrPayload,
  }) async {
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
        final distance = distanceMeters(
          latitudeA: location.latitude,
          longitudeA: location.longitude,
          latitudeB: settings.officeLatitude,
          longitudeB: settings.officeLongitude,
        ).round();
        if (distance > settings.officeRadiusMeters) {
          throw DomainException(
            'Estás a $distance m de ${settings.officeName}. '
            'Acércate a menos de ${settings.officeRadiusMeters} m para marcar en oficina.',
          );
        }
      }

      if (!mounted) return;
      setState(() => _marking = false);

      final confirmed = await _confirmGpsOnMap(location);
      if (!confirmed || !mounted) return;

      final photo = await _photoService.takePhoto();
      if (!mounted) return;
      if (photo == null) {
        await _showAlert(
          TechnicianAlertKind.info,
          'Foto obligatoria',
          'Debes tomar una foto del entorno del lugar para registrar la asistencia.',
        );
        return;
      }

      setState(() {
        _marking = true;
        _markingLabel = 'Subiendo foto y asistencia...';
      });

      final attendance = await deps.markAttendanceUseCase.execute(
        user,
        origin: origin,
        location: location,
        areaId: areaId,
        officeQrPayload: officeQrPayload,
        environmentPhoto: photo,
      );
      if (!mounted) return;
      setState(() {
        _today = attendance;
        _marking = false;
      });
      await _showAlert(
        TechnicianAlertKind.success,
        'Asistencia marcada',
        'Quedó registrada como ${origin.label} a las ${_formatTime(attendance.createdAt)}, '
        'con GPS y foto del entorno. Ya no puedes volver a marcar hoy.',
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
        'Revisa el GPS, el QR y tu conexión. Luego intenta de nuevo.',
      );
    }
  }

  Future<bool> _confirmGpsOnMap(GeoLocation location) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        final lat = location.latitude.toStringAsFixed(6);
        final lng = location.longitude.toStringAsFixed(6);
        final accuracy = location.accuracyMeters == null
            ? ''
            : ' · ±${location.accuracyMeters!.round()} m';
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Confirma tu ubicación GPS',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  '$lat, $lng$accuracy',
                  style: const TextStyle(color: Color(0xFF6B7385)),
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    height: 220,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.network(
                          _osmTileUrl(location.latitude, location.longitude),
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const ColoredBox(
                            color: Color(0xFFE8EEF5),
                            child: Center(
                              child: Icon(
                                Icons.map_rounded,
                                size: 48,
                                color: Color(0xFF1565C0),
                              ),
                            ),
                          ),
                        ),
                        const Center(
                          child: Icon(
                            Icons.location_on_rounded,
                            size: 44,
                            color: Color(0xFFD32F2F),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Luego toma una foto del entorno del lugar. Es obligatoria.',
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Confirmar y tomar foto'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cancelar'),
                ),
              ],
            ),
          ),
        );
      },
    );
    return result == true;
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
                        '${settings.officeName} · GPS y foto del entorno obligatorios.',
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
                    color: const Color(0xFF1565C0),
                    icon: Icons.qr_code_scanner_rounded,
                    title: 'Estoy en oficina',
                    subtitle: 'Escanea el QR, GPS y foto del entorno.',
                    onTap: _marking ? null : _markOffice,
                  ),
                  const SizedBox(height: 12),
                  _ActionCard(
                    color: const Color(0xFF2E7D32),
                    icon: Icons.terrain_rounded,
                    title: 'Voy directo a campo',
                    subtitle: 'Elige el área. GPS en el mapa y foto del entorno.',
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: isOffice
                      ? const Color(0x221565C0)
                      : const Color(0x222E7D32),
                  foregroundColor: isOffice
                      ? const Color(0xFF1565C0)
                      : const Color(0xFF2E7D32),
                  child: Icon(
                    isOffice
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
                      Text('Marcada a las $timeLabel'),
                    ],
                  ),
                ),
                const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32)),
              ],
            ),
            if (attendance.areaName.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Área: ${attendance.areaName}'),
            ],
            if (attendance.origin == AttendanceOrigin.oficina) ...[
              const SizedBox(height: 6),
              const Text('Ubicación validada dentro de la oficina'),
            ],
            const SizedBox(height: 6),
            Text(
              'GPS: ${attendance.location.latitude.toStringAsFixed(5)}, '
              '${attendance.location.longitude.toStringAsFixed(5)}',
            ),
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
