import { useState } from "react";
import { Pressable, Share, Text } from "react-native";
import { Sheet } from "./Sheet";
import { BrandLockup } from "./BrandLockup";
import { useEntryTheme } from "../src/theme";

export function ShareSheet({ title, path, onHero = false }: { title: string; path: string; onHero?: boolean }) {
  const theme = useEntryTheme();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const url = `https://hoopcheck.online${path}`;
  async function share() {
    try { await Share.share({ title, message: `${title}\nShared via HoopCheck™\n${url}` }); }
    catch { setError("Couldn’t open sharing. Please try again."); }
  }
  return <>
    <Pressable accessibilityRole="button" onPress={() => { setError(""); setOpen(true); }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: onHero ? theme.entityHero.ink : theme.accent }}>Share profile</Text></Pressable>
    <Sheet open={open} onClose={() => setOpen(false)} title="Share profile">
      <BrandLockup size={32} />
      <Text style={{ color: theme.foreground, fontSize: 18 }}>{title}</Text>
      <Text selectable style={{ color: theme.muted }}>{url}</Text>
      <Pressable accessibilityRole="button" onPress={() => void share()} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent }}>Choose where to share</Text></Pressable>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text> : null}
    </Sheet>
  </>;
}
