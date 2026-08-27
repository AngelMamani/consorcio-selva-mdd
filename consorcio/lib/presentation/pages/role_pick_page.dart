import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../domain/value_objects/user_role.dart';
import '../state/session_controller.dart';
import '../theme/app_theme.dart';

class RolePickPage extends StatelessWidget {
  const RolePickPage({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    final user = session.user;
    final roles = user?.mobileRoles ?? const <UserRole>[];

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '¿Con qué rol ingresas?',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    user == null
                        ? 'Elige tu interfaz de trabajo.'
                        : 'Hola, ${user.displayName}. Cada rol abre su pantalla.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      color: AppTheme.mutedOf(context),
                    ),
                  ),
                  const SizedBox(height: 24),
                  for (final role in roles) ...[
                    _RoleCard(
                      role: role,
                      onTap: () => session.selectActiveRole(role),
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextButton(
                    onPressed: session.logout,
                    child: const Text('Cancelar e ingresar con otra cuenta'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({required this.role, required this.onTap});

  final UserRole role;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.7),
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                role.label,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                role.accessHint,
                style: TextStyle(
                  fontSize: 13,
                  color: AppTheme.mutedOf(context),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
