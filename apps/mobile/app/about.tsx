import { useEffect, useRef, useState } from "react";
import { readServiceObservation, type ServiceObservation } from "../src/native/serviceObservation";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Button, SectionHeader } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { overseasGuideIntro, overseasGuideSections, overseasGuideNotice } from "../src/native/overseasGuide";

// Public editorial copy from app/about/page.tsx; no account or role data is loaded.
export default function AboutScreen() {
  const theme = useEntryTheme();
  const [observation, setObservation] = useState<ServiceObservation | null>(null);
  const [checking, setChecking] = useState(false);
  const [expandedGuide, setExpandedGuide] = useState<string[]>([]);
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
    <View style={{ gap: theme.spacing.sm }}><SectionHeader>Overseas Basketball Guide</SectionHeader><Text style={{ color: theme.foreground, ...theme.type.body }}>{overseasGuideIntro}</Text>
      {overseasGuideSections.map(section => { const expanded = expandedGuide.includes(section.id); return <View key={section.id} style={{gap:theme.spacing.sm}}>
        <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={() => setExpandedGuide(previous => previous.includes(section.id) ? previous.filter(id => id !== section.id) : [...previous, section.id])} style={{minHeight:48,justifyContent:"center",paddingHorizontal:12,borderWidth:1,borderColor:theme.border,borderRadius:theme.radius.control}}><Text style={{color:theme.foreground,fontWeight:"700"}}>{section.title}{expanded ? " −" : " +"}</Text></Pressable>
        {expanded ? section.checks.map(check => <Text key={check} style={{ color: theme.foreground, ...theme.type.body }}>• {check}</Text>) : null}
      </View>; })}
      <Text style={{ color: theme.muted, ...theme.type.body }}>{overseasGuideNotice}</Text>
    </View>
    <View style={{ gap: theme.spacing.sm }}><SectionHeader>Service check</SectionHeader><Text style={{ color: theme.muted }}>Check whether the HoopCheck web API responds. This does not verify sign-in, billing, live scores or other services.</Text><Button secondary disabled={checking} onPress={() => void checkService()}>{checking ? "Checking…" : "Check service"}</Button><Text accessibilityLiveRegion="polite" style={{color:theme.foreground}}>{observation ? `${observation.status === "maintenance_announced" ? "Maintenance announced" : "Web API responded"} · ${new Date(observation.observedAt).toLocaleString()}` : unavailable ? "Status unavailable. Your connection or the service may be unavailable." : "Not checked yet."}</Text></View>
    <View style={{ gap: theme.spacing.sm }}><SectionHeader>Company information</SectionHeader><Text style={{ color: theme.foreground, ...theme.type.body }}>HoopCheck serves players, fans, coaches, agents, clubs and basketball organizations around the world. Our official website is hoopcheck.online. Entity, registration and business address details will be published once verified.</Text></View>
  </ScrollView>;
}
