import { useColorScheme } from "react-native";

export function useEntryTheme() {
  const dark = useColorScheme() !== "light";
  return {
    dark,
    background: dark ? "#101014" : "#F7F6F3",
    surface: dark ? "#1B1B21" : "#FFFFFF",
    foreground: dark ? "#F9F8FA" : "#1C1B20",
    muted: dark ? "#B9B7C2" : "#575560",
    border: dark ? "#41404A" : "#D6D2D9",
    accent: dark ? "#FF9256" : "#A43709",
    accentSurface: dark ? "#38241D" : "#FDE9DD",
    button: "#FF793D",
    onButton: "#1A100A",
    error: dark ? "#FFB4AB" : "#8C2525",
    errorSurface: dark ? "#3C2020" : "#FDECEC",
    success: dark ? "#86E3B2" : "#176B46",
    successSurface: dark ? "#193328" : "#DDF7E8",
    cardRadius: 20,
  };
}
