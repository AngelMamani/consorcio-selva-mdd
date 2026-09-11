import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../services/device_location_service.dart';
import '../services/location_share_controller.dart';
import '../state/session_controller.dart';

/// Pide GPS y publica ubicación, pero **no bloquea** toda la app.
/// Acciones críticas (marcar asistencia, etc.) validan GPS por su cuenta.
class GpsRequiredGate extends StatefulWidget {
  const GpsRequiredGate({super.key, required this.child});

  final Widget child;

  @override
  State<GpsRequiredGate> createState() => _GpsRequiredGateState();
}

class _GpsRequiredGateState extends State<GpsRequiredGate>
    with WidgetsBindingObserver {
  final _locationService = DeviceLocationService();
  StreamSubscription<ServiceStatus>? _serviceSub;
  Timer? _poll;
  LocationShareController? _share;

  bool _ready = false;
  bool _checking = true;
  bool _permissionBlocked = false;
  bool _bannerDismissed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _serviceSub = _locationService.watchGpsService().listen((_) {
      unawaited(_refresh());
    });
    _poll = Timer.periodic(const Duration(seconds: 45), (_) {
      unawaited(_refresh());
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = context.read<SessionController>();
      final deps = context.read<AppDependencies>();
      final user = session.user;
      if (user != null) {
        _share = LocationShareController(deps.publishOwnLocationUseCase)
          ..attach(user);
        if (mounted) setState(() {});
      }
      unawaited(_refresh(requestPermission: true));
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_serviceSub?.cancel());
    _poll?.cancel();
    unawaited(_share?.dispose());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_refresh(requestPermission: true));
    }
  }

  Future<void> _refresh({
    bool requestPermission = false,
    bool openSettings = false,
  }) async {
    final results = await Future.wait([
      Geolocator.isLocationServiceEnabled(),
      Geolocator.checkPermission(),
    ]);
    var enabled = results[0] as bool;
    var permission = results[1] as LocationPermission;

    if (requestPermission && permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (openSettings) {
      if (!enabled) {
        await _locationService.openGpsSettings();
      } else if (permission == LocationPermission.deniedForever) {
        await _locationService.openAppSettings();
      } else if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      final refreshed = await Future.wait([
        Geolocator.isLocationServiceEnabled(),
        Geolocator.checkPermission(),
      ]);
      enabled = refreshed[0] as bool;
      permission = refreshed[1] as LocationPermission;
    }

    final allowed = permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
    final ready = enabled && allowed;
    if (!mounted) return;
    setState(() {
      _ready = ready;
      _checking = false;
      _permissionBlocked = permission == LocationPermission.deniedForever ||
          permission == LocationPermission.denied;
      if (ready) _bannerDismissed = false;
    });
    unawaited(_share?.setGpsReady(ready));
  }

  @override
  Widget build(BuildContext context) {
    final share = _share;
    final showBanner = !_ready && !_bannerDismissed;

    final body = Column(
      children: [
        if (showBanner)
          _GpsStatusBanner(
            checking: _checking,
            permissionBlocked: _permissionBlocked,
            onActivate: () => _refresh(
              requestPermission: true,
              openSettings: true,
            ),
            onDismiss: () => setState(() => _bannerDismissed = true),
          ),
        Expanded(child: widget.child),
      ],
    );

    if (share == null) return body;
    return Provider<LocationShareController>.value(
      value: share,
      updateShouldNotify: (_, __) => false,
      child: body,
    );
  }
}

class _GpsStatusBanner extends StatelessWidget {
  const _GpsStatusBanner({
    required this.checking,
    required this.permissionBlocked,
    required this.onActivate,
    required this.onDismiss,
  });

  final bool checking;
  final bool permissionBlocked;
  final VoidCallback onActivate;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.errorContainer,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.location_off_rounded,
                color: scheme.onErrorContainer,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      checking ? 'Comprobando GPS…' : 'GPS desactivado',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: scheme.onErrorContainer,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      permissionBlocked
                          ? 'Activa el permiso de ubicación. Sin GPS no podrás marcar asistencia ni ordenar rutas.'
                          : 'Puedes navegar, pero asistencia y ubicación en vivo necesitan GPS.',
                      style: TextStyle(
                        height: 1.3,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: scheme.onErrorContainer.withValues(alpha: 0.9),
                      ),
                    ),
                    if (!checking) ...[
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: onActivate,
                        icon: const Icon(Icons.my_location_rounded, size: 18),
                        label: const Text('Activar GPS'),
                        style: TextButton.styleFrom(
                          foregroundColor: scheme.onErrorContainer,
                          padding: EdgeInsets.zero,
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Ocultar',
                onPressed: onDismiss,
                icon: Icon(Icons.close, color: scheme.onErrorContainer),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
