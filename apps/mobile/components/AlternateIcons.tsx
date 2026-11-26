import { useEffect, useRef, useState } from "react";
import { AppState, Image, Platform, Pressable, Text, View } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { Sheet } from "./Sheet";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { motion } from "../src/motion/config";
import { useEntryTheme } from "../src/theme";

// Metro requires a static asset reference for bundled image resolution.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appIcon = require("../assets/app-icon.png");

const choices = [
  { name: "Classic", label: "Classic", plate: "#33363A" },
  { name: "Blackout", label: "Blackout", plate: "#101014" },
  { name: "Orange", label: "Orange", plate: "#FF793D" },
  { name: "Whiteout", label: "Whiteout", plate: "#F4F4F4" },
  { name: "Gold", label: "Gold Edition", plate: "#D4AF37" },
  { name: "Chrome", label: "Chrome", plate: "#BFC5CC" },
  { name: "ElectricBlue", label: "Electric Blue", plate: "#387CFF" },
  { name: "Stealth", label: "Stealth", plate: "#080808" },
  { name: "Court", label: "Court Edition", plate: "#AC713B" },
] as const;
type IconName = (typeof choices)[number]["name"];
const native = Platform.OS === "ios" ? requireOptionalNativeModule<{
  isSupported: () => Promise<boolean>; current: () => Promise<IconName>; select: (name: IconName) => Promise<IconName>;
}>("HoopcheckIcons") : null;

export function AlternateIcons() {
  const theme = useEntryTheme();
  const reduced = useMotionSetting();
  const [supported, setSupported] = useState(false);
  const [selected, setSelected] = useState<IconName>("Classic");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false), pending = useRef(false), generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const sync = async () => {
      if (!native || pending.current) return;
      const request = ++generation.current;
      try {
        const [available, current] = await Promise.all([native.isSupported(), native.current()]);
        if (mounted.current && request === generation.current && !pending.current) {
          setSupported(available && choices.some(choice => choice.name === current));
          if (choices.some(choice => choice.name === current)) setSelected(current);
        }
      } catch { if (mounted.current && request === generation.current) setSupported(false); }
    };
    void sync();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void sync(); });
    return () => { mounted.current = false; generation.current++; listener.remove(); };
  }, []);
  async function select(name: IconName) {
    if (!native || pending.current || !supported || selected === name) return;
    pending.current = true; generation.current++;
    setBusy(true); setError("");
    try {
      await native.select(name);
      const current = await native.current();
      if (!choices.some(choice => choice.name === current) || current !== name) throw Error("Icon state not confirmed");
      if (mounted.current) setSelected(current);
    } catch {
      try { const current = await native.current(); if (mounted.current && choices.some(choice => choice.name === current)) setSelected(current); }
      catch { if (mounted.current) setSupported(false); }
      if (mounted.current) setError("Could not confirm the app icon. Check your Home Screen and try again.");
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  if (!supported) return null;
  return <>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent, fontSize: 17 }}>App icon · {choices.find(choice => choice.name === selected)?.label ?? "Classic"}</Text></Pressable>
    <Sheet title="App icon" open={open} onClose={() => setOpen(false)}>
      {choices.map(({ name, label, plate }) => <Pressable key={name} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected === name, disabled: busy || selected === name }} disabled={busy || selected === name} onPress={() => void select(name)} style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? .75 : 1 })}><View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: plate, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center", overflow: "hidden" }}><Image accessible={false} alt="" source={appIcon} resizeMode="contain" style={{ width: name === "Classic" ? 42 : 36, height: name === "Classic" ? 42 : 36 }} /></View><Text style={{ flex: 1, color: selected === name ? theme.accent : theme.foreground }}>{label}{selected === name ? " · selected" : ""}</Text>{selected === name ? <Animated.View accessible={false} entering={reduced ? undefined : FadeIn.duration(motion.fade)}><Ionicons name="checkmark-circle" size={22} color={theme.accent} /></Animated.View> : null}</Pressable>)}
      {error ? <Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text> : null}
    </Sheet>
  </>;
}
