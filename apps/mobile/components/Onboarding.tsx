import { BrandLogo } from "./BrandLogo";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDevicePreferences, type Role } from "../src/native/preferences";
import { themeIsDark, type ThemePreference } from "../src/native/themePreference";
import { useEntryTheme, getEntryTheme } from "../src/theme";
import { useColorScheme } from "react-native";
import { Reveal } from "./Motion";

const roles: { role: Role; label: string; detail: string }[] = [
  { role: "player", label: "Player", detail: "Research clubs, build your career and connect with basketball." },
  { role: "fan", label: "Fan", detail: "Discover teams, follow games and join the community." },
  { role: "coach", label: "Coach", detail: "Explore players, clubs and coaching connections." },
  { role: "agent", label: "Agent", detail: "Discover talent and professional connections." },
  { role: "scout", label: "Scout", detail: "Explore prospects, leagues and teams." },
  { role: "manager", label: "Team Manager", detail: "Explore clubs, rosters and team communities." },
];

export function Onboarding({ signedIn = false }: { signedIn?: boolean }) {
  const { ready, preferences, update } = useDevicePreferences();
  const theme = useEntryTheme();
  const system = useColorScheme();
  const [step, setStep] = useState(0);
  // Registration preference only: never infer a signed-in user's role from the device.
  const [role, setRole] = useState<Role | undefined>(signedIn ? undefined : preferences.role);
  const [appearance, setAppearance] = useState<ThemePreference>(preferences.theme);
  const [haptics, setHaptics] = useState(preferences.haptics);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const total = signedIn ? 2 : 3;
  const isRole = !signedIn && step === 1;
  const isAppearance = step === total - 1;
  const selected = roles.find(item => item.role === role);
  const preview = getEntryTheme(themeIsDark(appearance, system), appearance === "midnight");
  async function finish(skip = false) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await update(skip ? { onboardingDone: true } : {
        onboardingDone: true, theme: appearance, haptics,
        ...(!signedIn && role ? { role } : {}),
      });
    } catch { setError("Couldn’t save your choice. Please try again."); }
    finally { setBusy(false); }
  }
  // AppLock owns the sole native modal. Existing completed installs are unchanged.
  if (!ready || preferences.onboardingDone) return null;
  const choices: { value: ThemePreference; label: string }[] = [
    { value: "system", label: "Device" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "midnight", label: "Midnight Black" },
  ];
  const heading = isRole ? "How do you join the game?" : isAppearance ? "Make it your court." : "Welcome to your court.";
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text accessibilityLiveRegion="polite" style={{ color: theme.muted, fontWeight: "700" }}>Step {step + 1} of {total}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void finish(true)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent, fontSize: 16 }}>Skip</Text></Pressable>
      </View>
      <View accessible={false} style={{ flexDirection: "row", gap: 5 }}>{Array.from({length:total},(_,index)=><View key={index} style={{flex:1,height:4,borderRadius:4,backgroundColor:index<=step?theme.accent:theme.border}}/>)}</View>
      <BrandLogo />
      <Reveal key={step}>
        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "800", letterSpacing: 1 }}>BASKETBALL WITHOUT BORDERS</Text>
        <Text accessibilityRole="header" style={{ color: theme.foreground, fontFamily: "HoopCheckDisplay", fontSize: 30, lineHeight: 34, marginVertical: 12 }}>{heading}</Text>
        <Text style={{ color: theme.muted, fontSize: 16, lineHeight: 23 }}>{isRole ? "Choose a role to prefill registration. This does not grant account access." : isAppearance ? "Preview your appearance and choose device feedback. Change these any time in Settings." : "Research clubs, follow basketball and connect with your community. Your access follows your verified account and membership."}</Text>
      </Reveal>
      {isRole ? <View accessibilityRole="radiogroup" accessibilityLabel="Registration account type" style={{ gap: 8 }}>
        {roles.map(item => <Pressable key={item.role} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: role === item.role, disabled: busy }} onPress={() => setRole(item.role)}
          style={{ minHeight: 56, padding: 12, gap: 4, borderRadius: 14, backgroundColor: role === item.role ? theme.accentSurface : theme.surface, borderWidth: 1, borderColor: role === item.role ? theme.accent : theme.border }}>
          <Text style={{ color: theme.foreground, fontWeight: "800", fontSize: 16 }}>{item.label}{role === item.role ? " ✓" : ""}</Text>
          <Text style={{ color: theme.muted, lineHeight: 19 }}>{item.detail}</Text>
        </Pressable>)}
      </View> : null}
      {isAppearance ? <View style={{ gap: 14 }}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Appearance preview" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {choices.map(item => <Pressable key={item.value} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: appearance === item.value }} onPress={() => setAppearance(item.value)} style={{ flexGrow: 1, minHeight: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: appearance === item.value ? theme.accent : theme.border, backgroundColor: appearance === item.value ? theme.accentSurface : theme.surface }}><Text style={{ color: theme.foreground, fontWeight: "700" }}>{item.label}</Text></Pressable>)}
        </View>
        <View testID="welcome-theme-preview" accessible={false} style={{ backgroundColor: preview.background, borderColor: preview.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 }}>
          <Text style={{ color: preview.accent, fontFamily: "HoopCheckDisplay", fontSize: 21 }}>MY COURT</Text>
          <View style={{ borderRadius: 12, backgroundColor: preview.surface, padding: 12 }}><Text style={{ color: preview.foreground, fontWeight: "700" }}>{selected?.label ?? "Your basketball world"}</Text><Text style={{ color: preview.muted, marginTop: 5 }}>{selected?.detail ?? "Explore your teams, games and profile."}</Text></View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: theme.foreground, fontSize: 16 }}>Haptic feedback</Text><Switch accessibilityLabel="Haptic feedback" disabled={busy} value={haptics} onValueChange={setHaptics} />
        </View>
        <Text style={{ color: theme.muted, lineHeight: 20 }}>Appearance and haptics are device settings. Follow teams, manage your profile and personalize account features after signing in.</Text>
      </View> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: theme.accent }}>{error}</Text> : null}
      <View style={{ marginTop: "auto", gap: 8 }}>
        <Pressable accessibilityRole="button" disabled={busy || (isRole && !role)} accessibilityState={{ disabled: busy || (isRole && !role), busy }} onPress={() => isAppearance ? void finish() : setStep(value => Math.min(total - 1, value + 1))} style={{ minHeight: 50, justifyContent: "center", alignItems: "center", backgroundColor: theme.button, borderRadius: 16, opacity: busy || (isRole && !role) ? .5 : 1 }}>
          <Text style={{ color: theme.onButton, fontWeight: "800" }}>{busy ? "Saving…" : isAppearance ? "Enter HoopCheck" : "Continue"}</Text>
        </Pressable>
        {step > 0 ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setStep(value => Math.max(0,value-1))} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}><Text style={{ color: theme.muted, fontWeight: "700" }}>Back</Text></Pressable> : null}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
