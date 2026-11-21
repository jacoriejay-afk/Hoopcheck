import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { Button, SectionHeader } from "../src/primitives";
import { useEntryTheme } from "../src/theme";

// Public editorial copy from app/about/page.tsx; no account or role data is loaded.
export default function AboutScreen() {
  const theme = useEntryTheme(); const router = useRouter();
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
    <Button secondary onPress={() => router.push({ pathname: "/web", params: { path: "/company" } })}>Company information on HoopCheck</Button>
  </ScrollView>;
}
