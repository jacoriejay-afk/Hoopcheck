import { Platform, useColorScheme } from "react-native";

// Canonical source: app/hoopcheck-theme-tokens.css and app/styles/liquid-glass.css.
export const tokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { control: 12, card: 16, hero: 20, pill: 999 },
  roles: { women: "#E84393", coaches: "#2456C8", leagues: "#1E9E50", players: "#6C3FD4", alerts: "#F5B800" },
  type: {
    display: { fontFamily: "HoopCheckDisplay", fontSize: 48, fontWeight: "400" as const, letterSpacing: -1.68, lineHeight: 49 },
    section: { fontSize: 17, fontWeight: "700" as const, lineHeight: 22 },
    body: { fontSize: 16, lineHeight: 24 },
    caption: { fontSize: 12, lineHeight: 17 },
    fontFamily: Platform.select({ ios: "System", android: "sans-serif", default: "Arial" }),
  },
};
export function getEntryTheme(dark: boolean) {
  return {
    ...tokens, dark,
    background: dark ? "#000000" : "#F4F4F1",
    surface: dark ? "#171717" : "#FFFFFF",
    elevatedSurface: dark ? "#1B1B1B" : "#F8F8F6",
    foreground: dark ? "#F7F7F5" : "#171717",
    muted: dark ? "#BDBDBD" : "#535353",
    border: dark ? "#414141" : "#D2D2CC",
    input: dark ? "#141414" : "#FFFFFF",
    accent: dark ? "#FF8A5C" : "#B83E14",
    accentSurface: dark ? "#3A2119" : "#FFF0E9",
    chip: dark ? "#242424" : "#F1F1ED",
    onChip: dark ? "#E7E7E1" : "#4C4C46",
    button: "#FF5A1F", onButton: "#111111", cardRadius: tokens.radius.card,
    error: dark ? "#FFD7D7" : "#171717",
    success: dark ? "#86E3B2" : "#176B46",
    successSurface: dark ? "#193328" : "#DDF7E8",
    errorSurface: dark ? "#351616" : "#F8F8F6",
    glassFill: dark ? "rgba(23,23,23,.92)" : "rgba(255,255,255,.92)",
    shadow: { shadowColor: "#000000", shadowOffset: { width: 0, height: 12 }, shadowRadius: 32, shadowOpacity: dark ? .32 : .12, elevation: 8 },
  };
}
export function useEntryTheme() { return getEntryTheme(useColorScheme() !== "light"); }
export type EntryTheme = ReturnType<typeof getEntryTheme>;
