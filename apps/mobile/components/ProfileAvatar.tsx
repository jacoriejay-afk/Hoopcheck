import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useEntryTheme } from "../src/theme";
import { safeAvatar } from "../src/native/playerProfiles";
export function ProfileAvatar({ url, name, size = 48 }: { url?: string | null; name: string; size?: number }) {
  const theme = useEntryTheme(); const [failed, setFailed] = useState<string | null>(null); const source = safeAvatar(url);
  const style = { width: size, height: size, borderRadius: size / 2 };
  return source && failed !== source ? <Image alt={`${name} profile photo`} accessibilityLabel={`${name} profile photo`} source={{ uri: source }} onError={() => setFailed(source)} style={style} /> : <View style={{ ...style, backgroundColor: theme.chip, alignItems: "center", justifyContent: "center" }}><Text style={{ color: theme.onChip, fontSize: size / 3, fontWeight: "800" }}>{name.slice(0, 1).toUpperCase() || "P"}</Text></View>;
}
