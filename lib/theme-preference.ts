export const THEME_PREFERENCES = ["system", "light", "dark", "midnight"] as const;
export type ThemePreference = typeof THEME_PREFERENCES[number];

export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "dynamic") return "dark";
  return THEME_PREFERENCES.find(preference => preference === value) ?? "system";
}

export function usesDarkPalette(preference: ThemePreference, systemDark = false) {
  return preference === "dark" || preference === "midnight" || (preference === "system" && systemDark);
}
