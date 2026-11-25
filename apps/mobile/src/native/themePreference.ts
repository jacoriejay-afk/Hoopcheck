export type ThemePreference = "system" | "light" | "dark" | "midnight";
let preference: ThemePreference = "system";
const listeners = new Set<() => void>();
export const getThemePreference = () => preference;
export const getServerThemePreference = (): ThemePreference => "system";
export function subscribeThemePreference(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setThemePreference(next: ThemePreference) {
  if (preference === next) return;
  preference = next;
  for (const listener of listeners) listener();
}
export function themeIsDark(selected: ThemePreference, system: string | null | undefined) {
  return selected === "dark" || selected === "midnight" || (selected === "system" && system !== "light");
}
