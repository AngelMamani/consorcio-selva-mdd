import 'package:flutter/material.dart';

class AppTheme {
  static const Color brandBlue = Color(0xFF1E88E5);
  static const Color brandGreen = Color(0xFF43A047);
  static const Color ink = Color(0xFF12151C);
  static const Color soft = Color(0xFFF4F7FB);
  static const Color darkSurface = Color(0xFF0E141D);
  static const Color darkCard = Color(0xFF1A2332);

  static bool isDarkOf(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  static Color mutedOf(BuildContext context) =>
      Theme.of(context).colorScheme.onSurfaceVariant;

  static Color statusBackground(BuildContext context, String status) {
    final dark = isDarkOf(context);
    if (status == 'COMPLETADA' || status == 'done') {
      return dark ? const Color(0xFF163528) : const Color(0xFFE8F5E9);
    }
    if (status == 'EN_PROGRESO' || status == 'progress') {
      return dark ? const Color(0xFF16344A) : const Color(0xFFE3F2FD);
    }
    return dark ? const Color(0xFF3A2C14) : const Color(0xFFFFF8E1);
  }

  static Color statusForeground(BuildContext context, String status) {
    final dark = isDarkOf(context);
    if (status == 'COMPLETADA' || status == 'done') {
      return dark ? const Color(0xFFB6F0C2) : const Color(0xFF1B7A3A);
    }
    if (status == 'EN_PROGRESO' || status == 'progress') {
      return dark ? const Color(0xFFB3D9FF) : const Color(0xFF0D5CAD);
    }
    return dark ? const Color(0xFFFFE0A3) : const Color(0xFFB45309);
  }

  static ThemeData light() {
    const scheme = ColorScheme.light(
      primary: brandBlue,
      onPrimary: Colors.white,
      secondary: brandGreen,
      onSecondary: Colors.white,
      surface: Colors.white,
      onSurface: ink,
      onSurfaceVariant: Color(0xFF5C6778),
      outline: Color(0xFFD9DEE8),
      error: Color(0xFFC62828),
      onError: Colors.white,
    );

    return _base(scheme, scaffold: soft, card: Colors.white);
  }

  static ThemeData dark() {
    const scheme = ColorScheme.dark(
      primary: Color(0xFF7EC8FF),
      onPrimary: Color(0xFF00263D),
      secondary: Color(0xFF8BE09A),
      onSecondary: Color(0xFF003918),
      surface: darkCard,
      onSurface: Color(0xFFF4F7FC),
      onSurfaceVariant: Color(0xFFC5D1E0),
      outline: Color(0xFF4A5A70),
      error: Color(0xFFFF8A80),
      onError: Color(0xFF3B0002),
    );

    return _base(scheme, scaffold: darkSurface, card: darkCard);
  }

  static ThemeData _base(
    ColorScheme scheme, {
    required Color scaffold,
    required Color card,
  }) {
    final dark = scheme.brightness == Brightness.dark;

    return ThemeData(
      useMaterial3: true,
      brightness: scheme.brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffold,
      fontFamily: 'Roboto',
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        backgroundColor: dark ? const Color(0xFF152033) : Colors.white,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: dark ? const Color(0xFF152033) : Colors.white,
        indicatorColor: dark
            ? const Color(0xFF2B4D6E)
            : const Color(0xFFD6E9FA),
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: selected
                ? (dark ? const Color(0xFFC9E6FF) : brandBlue)
                : scheme.onSurfaceVariant,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected
                ? (dark ? const Color(0xFFC9E6FF) : brandBlue)
                : scheme.onSurfaceVariant,
          );
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: dark ? const Color(0xFF243044) : const Color(0xFFEEF3F8),
        selectedColor: dark ? const Color(0xFF2B4D6E) : const Color(0xFFD6E9FA),
        disabledColor: dark ? const Color(0xFF1C2533) : const Color(0xFFF1F3F6),
        labelStyle: TextStyle(
          color: scheme.onSurface,
          fontWeight: FontWeight.w700,
        ),
        secondaryLabelStyle: TextStyle(
          color: scheme.onSurface,
          fontWeight: FontWeight.w700,
        ),
        side: BorderSide(color: scheme.outline.withValues(alpha: 0.55)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? const Color(0xFF222C3D) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        hintStyle: TextStyle(color: scheme.onSurfaceVariant),
        labelStyle: TextStyle(color: scheme.onSurfaceVariant),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: scheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: scheme.primary, width: 1.6),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          backgroundColor: dark ? const Color(0xFF4AA3E8) : brandBlue,
          foregroundColor: Colors.white,
          disabledBackgroundColor:
              dark ? const Color(0xFF2A3A4D) : const Color(0xFFD9DEE8),
          disabledForegroundColor: scheme.onSurfaceVariant,
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          backgroundColor: dark ? const Color(0xFF4AA3E8) : brandBlue,
          foregroundColor: Colors.white,
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: scheme.onSurface,
          side: BorderSide(color: scheme.outline),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: dark ? const Color(0xFFB3D9FF) : brandBlue,
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: card,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: dark ? const Color(0xFF33455C) : const Color(0xFFE2E8F0),
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: card,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: scheme.onSurface,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
        contentTextStyle: TextStyle(
          color: scheme.onSurfaceVariant,
          fontSize: 15,
          height: 1.4,
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: dark ? const Color(0xFF2A384C) : ink,
        contentTextStyle: const TextStyle(color: Colors.white),
        actionTextColor: const Color(0xFFB3D9FF),
      ),
      dividerColor: scheme.outline.withValues(alpha: 0.45),
      listTileTheme: ListTileThemeData(
        iconColor: scheme.onSurfaceVariant,
        textColor: scheme.onSurface,
        subtitleTextStyle: TextStyle(color: scheme.onSurfaceVariant),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: dark ? const Color(0xFF4AA3E8) : brandBlue,
        foregroundColor: Colors.white,
      ),
    );
  }
}
