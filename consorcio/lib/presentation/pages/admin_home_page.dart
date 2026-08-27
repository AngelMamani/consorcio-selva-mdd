import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

import '../../application/composition_root.dart';
import '../state/session_controller.dart';
import '../widgets/app_update_dialog.dart';
import 'attendance_page.dart';
import 'admin_tasks_page.dart';
import 'areas_page.dart';
import 'stations_page.dart';
import 'support_page.dart';

class AdminHomePage extends StatefulWidget {
  const AdminHomePage({super.key});

  @override
  State<AdminHomePage> createState() => _AdminHomePageState();
}

class _AdminHomePageState extends State<AdminHomePage>
    with WidgetsBindingObserver {
  int _index = 0;
  bool _checkingUpdate = false;
  bool _updateDialogOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future<void>.delayed(const Duration(milliseconds: 600), _checkAppUpdate);
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkAppUpdate();
    }
  }

  Future<void> _checkAppUpdate() async {
    if (!mounted || _checkingUpdate || _updateDialogOpen) return;
    _checkingUpdate = true;

    final session = context.read<SessionController>();
    final deps = context.read<AppDependencies>();
    final user = session.user;
    if (user == null) {
      _checkingUpdate = false;
      return;
    }

    try {
      final info = await PackageInfo.fromPlatform();
      final installedCode = int.tryParse(info.buildNumber) ?? 0;
      final release = await deps.getMobileAppReleaseUseCase.execute(user);
      if (!mounted || release == null) return;
      if (!release.isNewerThan(installedCode)) return;

      _updateDialogOpen = true;
      await showAppUpdateDialog(
        context,
        release: release,
        installedVersionCode: installedCode,
      );
    } catch (_) {
      // Red o permiso: se vuelve a intentar al reabrir la app.
    } finally {
      _checkingUpdate = false;
      _updateDialogOpen = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          AdminTasksPage(),
          AreasPage(),
          AttendancePage(),
          StationsPage(),
          SupportPage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.checklist_outlined),
            selectedIcon: Icon(Icons.checklist_rounded),
            label: 'Tareas',
          ),
          NavigationDestination(
            icon: Icon(Icons.layers_outlined),
            selectedIcon: Icon(Icons.layers_rounded),
            label: 'Actividades',
          ),
          NavigationDestination(
            icon: Icon(Icons.fact_check_outlined),
            selectedIcon: Icon(Icons.fact_check_rounded),
            label: 'Asistencia',
          ),
          NavigationDestination(
            icon: Icon(Icons.electrical_services_outlined),
            selectedIcon: Icon(Icons.electrical_services_rounded),
            label: 'Estaciones',
          ),
          NavigationDestination(
            icon: Icon(Icons.support_agent_outlined),
            selectedIcon: Icon(Icons.support_agent_rounded),
            label: 'Soporte',
          ),
        ],
      ),
    );
  }
}
