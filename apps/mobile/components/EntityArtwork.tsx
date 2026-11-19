import { useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { DirectoryCrest } from "./DirectoryIdentity";
import { useEntryTheme } from "../src/theme";

type Props = { name: string; kind: "teams" | "women" | "leagues"; size?: number; logoUrl?: string | null; logoBg?: string | null };
export function EntityArtwork(props: Props) {
  let url: string | null = null;
  try { const value = new URL(props.logoUrl || ""); if (value.protocol === "https:" && !value.username && !value.password) url = value.toString(); } catch { /* Use the authored fallback when artwork is missing. */ }
  return url ? <RemoteArtwork key={url} {...props} url={url} /> : <DirectoryCrest name={props.name} kind={props.kind} size={props.size} />;
}
function RemoteArtwork({ name, kind, size = 72, logoBg, url }: Props & { url: string }) {
  const theme = useEntryTheme(); const [failed, setFailed] = useState(false); const [loaded, setLoaded] = useState(false);
  if (failed) return <DirectoryCrest name={name} kind={kind} size={size} />;
  return <View style={{ width: size + 14, height: size + 14, borderRadius: 14, borderCurve: "continuous", borderWidth: 1, borderColor: theme.border, padding: 6, backgroundColor: logoBg === "light" ? "#FFFFFF" : logoBg === "dark" ? theme.crest.panel : theme.surface }}>
    {!loaded ? <ActivityIndicator accessibilityLabel="Loading logo" color={theme.accent} style={{ position: "absolute", inset: 0 }} /> : null}
    <Image onLoad={() => setLoaded(true)} alt={`${name} logo`} accessibilityLabel={`${name} logo`} source={{ uri: url }} resizeMode="contain" onError={() => setFailed(true)} style={{ width: size, height: size }} />
  </View>;
}
