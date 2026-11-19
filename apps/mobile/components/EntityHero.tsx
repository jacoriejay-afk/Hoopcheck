import { Text, View } from "react-native";
import { CountryChip, DirectoryCrest } from "./DirectoryIdentity";
import { ShareSheet } from "./ShareSheet";
import { useEntryTheme } from "../src/theme";

/** Shared compact identity treatment for men's/women's teams and leagues. */
export function EntityHero({ name, country, kind, label, location, path }: {
  name: string; country: string | null; kind: "teams" | "women" | "leagues";
  label: string; location?: string; path: string;
}) {
  const theme = useEntryTheme();
  return <View style={{ backgroundColor: theme.entityHero.background, borderRadius: theme.radius.hero, borderCurve: "continuous", padding: theme.spacing.lg, gap: theme.spacing.md }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
      <DirectoryCrest name={name} kind={kind} size={72} />
      <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.sm }}>
        <Text style={{ color: theme.entityHero.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{label}</Text>
        <Text accessibilityRole="header" style={{ color: theme.entityHero.ink, fontFamily: "HoopCheckDisplay", fontSize: 28, lineHeight: 32 }}>{name}</Text>
      </View>
    </View>
    <CountryChip country={country} />
    {location ? <Text style={{ color: theme.entityHero.muted, fontSize: 14, lineHeight: 20 }}>{location}</Text> : null}
    <ShareSheet onHero title={name} path={path} />
  </View>;
}
