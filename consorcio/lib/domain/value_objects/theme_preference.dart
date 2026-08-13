class ThemePreference {
  static const String light = 'light';
  static const String dark = 'dark';

  static String normalize(String? value) {
    if (value == dark) return dark;
    return light;
  }

  static bool isDark(String? value) => normalize(value) == dark;

  static String toggle(String? value) =>
      isDark(value) ? light : dark;
}
