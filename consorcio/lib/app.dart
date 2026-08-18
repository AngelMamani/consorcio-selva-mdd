import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'domain/value_objects/theme_preference.dart';
import 'presentation/pages/change_password_page.dart';
import 'presentation/pages/login_page.dart';
import 'presentation/pages/technician_home_page.dart';
import 'presentation/state/session_controller.dart';
import 'presentation/theme/app_theme.dart';

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
          themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
          home: Builder(
            builder: (context) {
              if (session.bootstrapping) {
                return const Scaffold(
                  body: Center(child: CircularProgressIndicator()),
                );
              }
              if (session.isAuthenticated) {
                if (session.mustChangePassword) {
                  return const ChangePasswordPage();
                }
                return const TechnicianHomePage();
              }
              return const LoginPage();
            },
          ),
        );
      },
    );
  }
}
