import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useEntryTheme } from "../src/theme";

// Recents are local UI state, never invented popularity/trending metrics.
export function useRecentSearches(directory: string) {
  const [recents, setRecents] = useState<string[]>([]);
  const key = `hoopcheck:recents:${directory}`;
  useEffect(() => { let active = true; AsyncStorage.getItem(key).then(value => {
    const parsed: unknown = value ? JSON.parse(value) : [];
    if (active && Array.isArray(parsed)) setRecents(parsed.filter((item): item is string => typeof item === "string" && item.length <= 80).slice(0, 5));
  }).catch(() => {}); return () => { active = false; }; }, [key]);
  function remember(value: string) {
    const clean = value.trim().slice(0, 80);
    if (clean.length < 2) return;
    const next = [clean, ...recents.filter(item => item !== clean)].slice(0, 5);
    setRecents(next);
    void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
  }
  return { recents, remember };
}
export function RecentSearches({ items, onSelect }: { items: string[]; onSelect: (value: string) => void }) {
  const theme = useEntryTheme();
  if (!items.length) return null;
  return <View style={{ gap: 4 }}><Text style={{ color: theme.muted, marginTop: 12 }}>Recent searches</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{items.map(value => <Pressable key={value} accessibilityRole="button" onPress={() => onSelect(value)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10, backgroundColor: theme.accentSurface, borderRadius: 12 }}><Text style={{ color: theme.foreground }}>{value}</Text></Pressable>)}</View></View>;
}
