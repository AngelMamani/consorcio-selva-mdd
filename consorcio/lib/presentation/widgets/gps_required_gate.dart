import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../services/device_location_service.dart';
import '../services/location_share_controller.dart';
import '../state/session_controller.dart';

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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _serviceSub = _locationService.watchGpsService().listen((_) {
      unawaited(_refresh());
    });
    _poll = Timer.periodic(const Duration(seconds: 6), (_) {
      unawaited(_refresh());
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = context.read<SessionController>();
      final deps = context.read<AppDependencies>();
      final user = session.user;
      if (user != null) {
        _share = LocationShareController(deps.publishOwnLocationUseCase)
          ..attach(user);
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
    final enabled = await Geolocator.isLocationServiceEnabled();
    var permission = await Geolocator.checkPermission();
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
    }

    final nextEnabled = await Geolocator.isLocationServiceEnabled();
    final nextPermission = await Geolocator.checkPermission();
    final allowed = nextPermission == LocationPermission.always ||
        nextPermission == LocationPermission.whileInUse;
    final ready = nextEnabled && allowed;
    if (!mounted) return;
    setState(() {
      _ready = ready;
      _checking = false;
      _permissionBlocked = nextPermission == LocationPermission.deniedForever ||
          nextPermission == LocationPermission.denied;
    });
    unawaited(_share?.setGpsReady(ready));
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        IgnorePointer(
          ignoring: !_ready,
          child: widget.child,
        ),
        if (!_ready)
          Positioned.fill(
            child: _GpsLockScreen(
              checking: _checking,
              permissionBlocked: _permissionBlocked,
              onActivate: () => _refresh(
                requestPermission: true,
                openSettings: true,
              ),
            ),
          ),
      ],
    );
  }
}

class _GpsLockScreen extends StatelessWidget {
  const _GpsLockScreen({
    required this.checking,
    required this.permissionBlocked,
    required this.onActivate,
  });

  final bool checking;
  final bool permissionBlocked;
  final VoidCallback onActivate;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.location_off_rounded, size: 64),
              const SizedBox(height: 16),
              const Text(
                'GPS obligatorio',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              Text(
                permissionBlocked
                    ? 'Activa el permiso de ubicación en Ajustes. Sin GPS no puedes usar el aplicativo.'
                    : 'El GPS debe estar activado. Si lo apagas, el aplicativo se bloquea.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  height: 1.4,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 24),
              if (checking)
                const CircularProgressIndicator()
              else
                FilledButton.icon(
                  onPressed: onActivate,
                  icon: const Icon(Icons.my_location_rounded),
                  label: const Text('Activar GPS y continuar'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
