import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { useEntryTheme } from "../src/theme";
import { safeAvatar } from "../src/native/playerProfiles";

type Props = { url?: string | null; name: string; size?: number };
const AVATAR_LOAD_TIMEOUT_MS = 8000;

export function ProfileAvatar({ url, name, size = 48 }: Props) {
  const source = safeAvatar(url);
  return source ? <RemoteAvatar key={source} source={source} name={name} size={size} /> : <AvatarFallback name={name} size={size} />;
}

function AvatarFallback({ name, size }: { name: string; size: number }) {
  const theme = useEntryTheme();
  const initial = Array.from(name.trim().normalize("NFC"))[0]?.toUpperCase() || "P";
  return <View accessible accessibilityLabel={`${name} initials badge`} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.chip, alignItems: "center", justifyContent: "center" }}><Text style={{ color: theme.onChip, fontSize: size / 3, fontWeight: "800" }}>{initial}</Text></View>;
}

function RemoteAvatar({ source, name, size }: { source: string; name: string; size: number }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setStatus(previous => previous === "loading" ? "failed" : previous), AVATAR_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);
  if (status === "failed") return <AvatarFallback name={name} size={size} />;
  const loaded = status === "loaded";
  return <View style={{ width: size, height: size }}>
    {!loaded && <AvatarFallback name={name} size={size} />}
    <Image alt={`${name} profile photo`} accessibilityLabel={`${name} profile photo`} accessible={loaded} accessibilityElementsHidden={!loaded} importantForAccessibility={loaded ? "auto" : "no-hide-descendants"}
      source={{ uri: source }} onLoad={() => setStatus(previous => previous === "loading" ? "loaded" : previous)} onError={() => setStatus("failed")}
      style={{ position: "absolute", top: 0, left: 0, width: size, height: size, borderRadius: size / 2, opacity: loaded ? 1 : 0 }} />
  </View>;
}
