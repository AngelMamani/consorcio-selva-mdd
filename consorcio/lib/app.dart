import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'domain/value_objects/theme_preference.dart';
import 'domain/value_objects/user_role.dart';
import 'presentation/pages/admin_home_page.dart';
import 'presentation/pages/change_password_page.dart';
import 'presentation/pages/login_page.dart';
import 'presentation/pages/role_pick_page.dart';
import 'presentation/pages/technician_home_page.dart';
import 'presentation/state/session_controller.dart';
import 'presentation/theme/app_theme.dart';
import 'presentation/widgets/gps_required_gate.dart';

class ConsorcioApp extends StatelessWidget {
  const ConsorcioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionController>(
      builder: (context, session, _) {
        final isDark = ThemePreference.isDark(session.user?.theme);

        return MaterialApp(
          title: 'Consorcio Selva MDD',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: session.user == null
              ? ThemeMode.system
              : (isDark ? ThemeMode.dark : ThemeMode.light),
          home: Builder(
            builder: (context) {
              if (session.bootstrapping) {
                return const Scaffold(
                  body: Center(child: CircularProgressIndicator()),
                );
              }
              if (session.pendingRolePick) {
                return const RolePickPage();
              }
              if (session.isAuthenticated) {
                if (session.mustChangePassword) {
                  return const ChangePasswordPage();
                }
                if (session.user?.role == UserRole.administrador) {
                  return const GpsRequiredGate(child: AdminHomePage());
                }
                return const GpsRequiredGate(child: TechnicianHomePage());
              }
              return const LoginPage();
            },
          ),
        );
      },
    );
  }
}
