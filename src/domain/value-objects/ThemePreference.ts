export const ThemePreference = {
  Light: 'light',
  Dark: 'dark',
} as const

export type ThemePreference =
  (typeof ThemePreference)[keyof typeof ThemePreference]

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === ThemePreference.Light || value === ThemePreference.Dark
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : ThemePreference.Light
}
