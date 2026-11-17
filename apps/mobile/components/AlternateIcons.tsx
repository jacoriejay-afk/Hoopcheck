import { useEffect, useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Sheet } from "./Sheet";
import { useEntryTheme } from "../src/theme";

type IconName = "Classic" | "Blackout" | "Orange";
const native = Platform.OS === "ios" ? requireOptionalNativeModule<{
  isSupported: () => Promise<boolean>; current: () => Promise<IconName>; select: (name: IconName) => Promise<IconName>;
}>("HoopcheckIcons") : null;

export function AlternateIcons() {
  const theme = useEntryTheme();
  const [supported, setSupported] = useState(false);
  const [selected, setSelected] = useState<IconName>("Classic");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (native) void Promise.all([native.isSupported(), native.current()]).then(([supported, current]) => {
      if (active) { setSupported(supported); setSelected(current); }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function select(name: IconName) {
    if (!native || busy) return;
    setBusy(true); setError("");
    try { setSelected(await native.select(name)); }
    catch { setError("Couldn’t change the app icon. Your previous icon is still selected."); }
    finally { setBusy(false); }
  }
  if (!supported) return null;
  return <>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent, fontSize: 17 }}>App icon · {selected}</Text></Pressable>
    <Sheet title="App icon" open={open} onClose={() => setOpen(false)}>
      {(["Classic", "Blackout", "Orange"] as const).map(name => <Pressable key={name} accessibilityRole="radio" accessibilityState={{ checked: selected === name, disabled: busy }} disabled={busy} onPress={() => void select(name)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: selected === name ? theme.accent : theme.foreground }}>{name}{selected === name ? " · selected" : ""}</Text></Pressable>)}
      {error ? <Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text> : null}
    </Sheet>
  </>;
}
