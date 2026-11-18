import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDevicePreferences, type Role } from "../src/native/preferences";
import { useEntryTheme } from "../src/theme";
import { Reveal } from "./Motion";

// Metro requires a static require for bundled artwork.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const brandMark = require("../assets/hoopcheck-mark.png");
const panels = [
  ["Reviews", "Know who you're signing with", "Learn from players’ experiences before your next move."],
  ["Community", "Find your basketball community", "Connect through HoopFeed and HoopGroups. Access follows your membership."],
  ["Passport", "Your verified career", "Build your player identity and career history."],
] as const;
const roles: [Role, string][] = [["player", "Player"], ["fan", "Fan"], ["coach", "Coach"], ["agent", "Agent"], ["scout", "Scout"], ["manager", "Team"]];
export function Onboarding() {
  const { ready, preferences, update } = useDevicePreferences();
  const theme = useEntryTheme();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function finish(role?: Role) {
    if (busy) return;
    setBusy(true);
    try { await update({ onboardingDone: true, ...(role ? { role } : {}) }); }
    catch { setError("Couldn’t save your choice. Please try again."); }
    finally { setBusy(false); }
  }
  const panel = panels[step];
  // AppLock owns the sole native modal; onboarding only renders its content.
  if (!ready || preferences.onboardingDone) return null;
  return <>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
      <Pressable accessibilityRole="button" onPress={() => void finish()} disabled={busy} style={{ alignSelf: "flex-end", minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent, fontSize: 17 }}>Skip</Text></Pressable>
      <View style={{ flex: 1, justifyContent: "center", gap: 24 }}>
        <Image alt="HoopCheck" source={brandMark} style={{ width: 80, height: 80 }} accessibilityLabel="HoopCheck" />
        <Reveal key={step}>
          <Text style={{ color: theme.accent, fontSize: 18 }}>{panel?.[0] ?? "Your role"}</Text>
          <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 34, fontWeight: "900", marginVertical: 16 }}>{panel?.[1] ?? "How do you join the game?"}</Text>
          <Text style={{ color: theme.muted, fontSize: 17, lineHeight: 25 }}>{panel?.[2] ?? "Your choice prefills signup. It does not change account access."}</Text>
        </Reveal>
        {panel ? <Pressable accessibilityRole="button" onPress={() => setStep(step + 1)} style={{ padding: 18, backgroundColor: theme.button, borderRadius: 16 }}><Text style={{ color: theme.onButton, fontWeight: "800" }}>Continue · {step + 1} of 3</Text></Pressable> : roles.map(([role, label]) => <Pressable key={role} disabled={busy} accessibilityRole="button" onPress={() => void finish(role)} style={{ minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderColor: theme.border }}><Text style={{ color: theme.foreground, fontSize: 18 }}>{label}</Text></Pressable>)}
        {error ? <Text accessibilityRole="alert" style={{ color: theme.accent }}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  </>;
}
