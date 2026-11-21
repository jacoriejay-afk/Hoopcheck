import { useSyncExternalStore } from "react";
import { getThemePreference, getServerThemePreference, subscribeThemePreference, themeIsDark } from "./native/themePreference";
import { Platform, useColorScheme } from "react-native";

// Canonical source: app/hoopcheck-theme-tokens.css and app/styles/liquid-glass.css.
export const tokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { control: 12, card: 16, hero: 20, pill: 999 },
  // components/TeamLogo.tsx; directory crest artwork is theme-independent.
  // TeamProfileHero.tsx: solid first gradient stop for native authored hero art.
  entityHero: { background: "#111827", ink: "#FFFFFF", muted: "#E5E7EB" },
  crest: { panel: "#1A1A1A", border: "#2D2D2D", ink: "#F7F7F5", palette: ["#8A2A0D", "#8C1B53", "#173C86", "#176C3D", "#4C2A90", "#7B5900"] },
  // Build 9 Premium Courtside 2.0: shared native presentation primitives.
  // Opt-in tokens; existing screens retain their current styles until reviewed.
  courtside: {
    navigation: { height: 64, radius: 28, iconSize: 22, touchTarget: 44 },
    card: { radius: 22, compactPadding: 12, featuredPadding: 20 },
    hero: { radius: 22, minHeight: 156 },
    sectionGap: 24,
    court: { background: "#141B20", end: "#28352E", ink: "#FFFFFF", muted: "#CBD5CC", line: "rgba(255,255,255,0.12)", orange: "#FF8A50" },
    typography: { score: 36, hero: 38, eyebrow: 11 },
  },
  // QR codes require a fixed light optical background in either theme.
  qrSurface: "#FFFFFF",
  roles: { women: "#E84393", coaches: "#2456C8", leagues: "#1E9E50", players: "#6C3FD4", alerts: "#F5B800" },
  type: {
    display: { fontFamily: "HoopCheckDisplay", fontSize: 48, fontWeight: "400" as const, letterSpacing: -1.68, lineHeight: 49 },
    title: { fontFamily: "HoopCheckDisplay", fontSize: 32, lineHeight: 36 },
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
export function useEntryTheme() {
  const preference = useSyncExternalStore(subscribeThemePreference, getThemePreference, getServerThemePreference);
  return getEntryTheme(themeIsDark(preference, useColorScheme()));
}
export type EntryTheme = ReturnType<typeof getEntryTheme>;
