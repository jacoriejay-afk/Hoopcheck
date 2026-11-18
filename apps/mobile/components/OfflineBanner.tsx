import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useNetwork } from "../src/native/network";
import { useEntryTheme } from "../src/theme";

export function OfflineBanner({ savedAt }: { savedAt: number | null }) {
  const { offline } = useNetwork();
  const theme = useEntryTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  if (!offline) return null;
  return <View accessibilityRole="alert" style={{ backgroundColor: theme.accentSurface, padding: 10 }}><Text style={{ color: theme.foreground, fontSize: 12 }}>{savedAt ? `You’re offline — showing saved data · saved ${Math.max(0, Math.floor((now - savedAt) / 60000))} min ago` : "You’re offline — reconnect to load data or send changes."}</Text></View>;
}
