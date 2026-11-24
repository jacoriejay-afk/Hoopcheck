import { EntityArtwork } from "./EntityArtwork";
import { Text, View } from "react-native";
import { CountryChip } from "./DirectoryIdentity";
import { ShareSheet } from "./ShareSheet";
import { useEntryTheme } from "../src/theme";

/** Shared compact identity treatment for men's/women's teams and leagues. */
export function EntityHero({ name, country, kind, label, location, path, logoUrl, logoBg }: {
  name: string; country: string | null; kind: "teams" | "women" | "leagues";
  label: string; location?: string; path: string; logoUrl?: string | null; logoBg?: string | null;
}) {
  const theme = useEntryTheme();
  return <View style={{ backgroundColor: "transparent", borderBottomWidth: 1, borderColor: theme.border, paddingVertical: 10, gap: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
      <EntityArtwork name={name} kind={kind} size={64} logoUrl={logoUrl} logoBg={logoBg} />
      <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.sm }}>
        <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{label}</Text>
        <Text accessibilityRole="header" style={{ color: theme.foreground, fontFamily: "HoopCheckDisplay", fontSize: 25, lineHeight: 29 }}>{name}</Text>
      </View>
    </View>
    <CountryChip country={country} />
    {location ? <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>{location}</Text> : null}
    <ShareSheet title={name} path={path} />
  </View>;
}
