import { useSyncExternalStore } from "react";
import { getThemePreference, getServerThemePreference, subscribeThemePreference, themeIsDark } from "./native/themePreference";
import { Platform, useColorScheme } from "react-native";

// Canonical source: app/hoopcheck-theme-tokens.css and app/styles/liquid-glass.css.
export const tokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { control: 16, card: 22, hero: 28, pill: 999 },
  // components/TeamLogo.tsx; directory crest artwork is theme-independent.
  // TeamProfileHero.tsx: solid first gradient stop for native authored hero art.
  entityHero: { background: "#111827", ink: "#FFFFFF", muted: "#E5E7EB" },
  crest: { panel: "#1A1A1A", border: "#2D2D2D", ink: "#F7F7F5", palette: ["#8A2A0D", "#8C1B53", "#173C86", "#176C3D", "#4C2A90", "#7B5900"] },
  // Build 9 Premium Courtside 2.0: shared native presentation primitives.
  // Opt-in tokens; existing screens retain their current styles until reviewed.
  courtside: {
    navigation: { height: 60, radius: 22, iconSize: 21, touchTarget: 44 },
    card: { radius: 17, compactPadding: 10, featuredPadding: 12 },
    hero: { radius: 18, minHeight: 92 },
    sectionGap: 14,
    court: { background: "#0D1930", end: "#382024", ink: "#FFFFFF", muted: "#E3EAF1", line: "rgba(255,255,255,0.18)", orange: "#FF9855" },
    typography: { score: 28, hero: 25, eyebrow: 10 },
  },
  // QR codes require a fixed light optical background in either theme.
  qrSurface: "#FFFFFF",
  roles: { women: "#E84393", coaches: "#2456C8", leagues: "#1E9E50", players: "#6C3FD4", alerts: "#F5B800" },
  type: {
    ui: { fontFamily: Platform.select({ ios: "AvenirNext-DemiBold", android: "sans-serif-medium", default: "Arial" }) || "System" },
    display: { fontFamily: "HoopCheckDisplay", fontSize: 34, fontWeight: "400" as const, letterSpacing: -.8, lineHeight: 38 },
    title: { fontFamily: Platform.select({ ios: "AvenirNext-DemiBold", android: "sans-serif-medium", default: "Arial" }) || "System", fontSize: 24, lineHeight: 29 },
    section: { fontSize: 15, fontWeight: "700" as const, lineHeight: 20 },
    body: { fontSize: 16, lineHeight: 24 },
    caption: { fontSize: 12, lineHeight: 17 },
    fontFamily: Platform.select({ ios: "System", android: "sans-serif", default: "Arial" }),
  },
};
export function getEntryTheme(dark: boolean) {
  return {
    ...tokens, dark,
    background: dark ? "#080D16" : "#F5F7FB",
    surface: dark ? "#151E2D" : "#FFFFFF",
    elevatedSurface: dark ? "#1D2939" : "#F8FAFD",
    foreground: dark ? "#F6F8FF" : "#131B2B",
    muted: dark ? "#BCC9D8" : "#526275",
    border: dark ? "#354354" : "#DCE3ED",
    input: dark ? "#142034" : "#FFFFFF",
    accent: dark ? "#FF9A63" : "#AF4218",
    accentSurface: dark ? "#46291E" : "#FFEEE3",
    chip: dark ? "#243247" : "#EDF1F8",
    onChip: dark ? "#EBF1F8" : "#3E5064",
    button: "#FF5A1F", onButton: "#111111", cardRadius: tokens.radius.card,
    error: dark ? "#FFD7D7" : "#171717",
    success: dark ? "#86E3B2" : "#176B46",
    successSurface: dark ? "#193328" : "#DDF7E8",
    errorSurface: dark ? "#351616" : "#F8F8F6",
    glassFill: dark ? "rgba(19,30,47,0.65)" : "rgba(255,255,255,0.64)",
    glassBorder: dark ? "rgba(225,235,255,0.23)" : "rgba(255,255,255,0.94)",
    shadow: { shadowColor: "#000000", shadowOffset: { width: 0, height: 12 }, shadowRadius: 32, shadowOpacity: dark ? .32 : .12, elevation: 8 },
  };
}
export function useEntryTheme() {
  const preference = useSyncExternalStore(subscribeThemePreference, getThemePreference, getServerThemePreference);
  return getEntryTheme(themeIsDark(preference, useColorScheme()));
}
export type EntryTheme = ReturnType<typeof getEntryTheme>;
