import { useEffect, useRef, useState } from "react";
import { readServiceObservation, type ServiceObservation } from "../src/native/serviceObservation";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Button, SectionHeader } from "../src/primitives";
import { useEntryTheme } from "../src/theme";

// Public editorial copy from app/about/page.tsx; no account or role data is loaded.
export default function AboutScreen() {
  const theme = useEntryTheme(); const router = useRouter();
  const [observation, setObservation] = useState<ServiceObservation | null>(null);
  const [checking, setChecking] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  async function checkService() {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setChecking(true); setUnavailable(false); setObservation(null);
    try { const value = await readServiceObservation(process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online", fetch, controller.signal); if (pending.current === controller) setObservation(value); }
    catch { if (pending.current === controller) setUnavailable(true); }
    finally { if (pending.current === controller) { pending.current = null; setChecking(false); } }
  }
  return <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xl, gap: theme.spacing.xl }}>
    <BrandLogo />
    <Text style={{ color: theme.accent, ...theme.type.caption, fontWeight: "800", letterSpacing: 1 }}>ABOUT HOOPCHECK™</Text>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontFamily: "HoopCheckDisplay", fontSize: 32, lineHeight: 36 }}>Know Who You’re Signing With.</Text>
    <Text style={{ color: theme.foreground, ...theme.type.body }}>HoopCheck™ is a global basketball discovery and review platform built to help players research teams, coaches, leagues, and agents before making important career decisions.</Text>
    {[
      ["Our mission", "Make basketball opportunities more transparent by giving the community access to relevant information and firsthand player experiences."],
      ["Our vision", "A global basketball community where athletes can evaluate opportunities with greater confidence and organizations can build trust through accountability."],
      ["What we offer", "Discover basketball organizations, explore community reviews where eligible, connect with the game, and learn more before making a commitment. Reviews represent individual experiences, not independently guaranteed facts."],
    ].map(([title, body]) => <View key={title} style={{ gap: theme.spacing.sm }}><SectionHeader>{title}</SectionHeader><Text style={{ color: theme.muted, ...theme.type.body }}>{body}</Text></View>)}
    <View style={{ gap: theme.spacing.sm }}><SectionHeader>Service check</SectionHeader><Text style={{ color: theme.muted }}>Check whether the HoopCheck web API responds. This does not verify sign-in, billing, live scores or other services.</Text><Button secondary disabled={checking} onPress={() => void checkService()}>{checking ? "Checking…" : "Check service"}</Button><Text accessibilityLiveRegion="polite" style={{color:theme.foreground}}>{observation ? `${observation.status === "maintenance_announced" ? "Maintenance announced" : "Web API responded"} · ${new Date(observation.observedAt).toLocaleString()}` : unavailable ? "Status unavailable. Your connection or the service may be unavailable." : "Not checked yet."}</Text></View>
    <Button secondary onPress={() => router.push({ pathname: "/web", params: { path: "/company" } })}>Company information on HoopCheck</Button>
  </ScrollView>;
}
