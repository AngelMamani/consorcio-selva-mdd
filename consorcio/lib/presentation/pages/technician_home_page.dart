import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../state/session_controller.dart';
import '../widgets/app_update_dialog.dart';
import 'attendance_page.dart';
import 'areas_page.dart';

class TechnicianHomePage extends StatefulWidget {
  const TechnicianHomePage({super.key});

  @override
  State<TechnicianHomePage> createState() => _TechnicianHomePageState();
}

class _TechnicianHomePageState extends State<TechnicianHomePage> {
  int _index = 0;
  bool _checkedUpdate = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkAppUpdate());
  }

  Future<void> _checkAppUpdate() async {
    if (_checkedUpdate || !mounted) return;
    _checkedUpdate = true;

    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) return;

    try {
      final info = await PackageInfo.fromPlatform();
      final installedCode = int.tryParse(info.buildNumber) ?? 0;
      final release = await deps.getMobileAppReleaseUseCase.execute(user);
      if (!mounted || release == null) return;
      if (!release.isNewerThan(installedCode)) return;
      await showAppUpdateDialog(
        context,
        release: release,
        installedVersionCode: installedCode,
      );
    } catch (_) {
      // Si no hay red o permiso, no bloquea el uso de la app.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          AreasPage(),
          AttendancePage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.layers_outlined),
            selectedIcon: Icon(Icons.layers_rounded),
            label: 'Áreas',
          ),
          NavigationDestination(
            icon: Icon(Icons.fact_check_outlined),
            selectedIcon: Icon(Icons.fact_check_rounded),
            label: 'Asistencia',
          ),
        ],
      ),
    );
  }
}
