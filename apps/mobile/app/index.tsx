import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BrandLogo } from "../components/BrandLogo";
import { ExploreLinks } from "../components/ExploreLinks";
import { Button, Input, SectionHeader } from "../src/primitives";
import { useEntryTheme } from "../src/theme";

export default function WelcomeScreen() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const compact = width < 360;
  const stack = compact || fontScale > 1.25;
  const searchDirectory = () => router.push({ pathname: "/search", params: { q: search.trim() } });
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingHorizontal: compact ? 12 : 16, paddingTop: 8, paddingBottom: 24 }}>
      <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", gap: 12 }}>
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <BrandLogo onHero={theme.dark} />
        </View>
        <View style={{ flexDirection: stack ? "column" : "row", alignItems: stack ? "stretch" : "center", gap: 8 }}>
          <Input accessibilityLabel="Search basketball directory: teams, leagues, coaches or players"
            placeholder="Search basketball…" value={search} maxLength={100}
            onChangeText={setSearch} returnKeyType="search" onSubmitEditing={searchDirectory}
            style={{ minWidth: 0, ...(stack ? {} : { flex: 1 }), minHeight: 48, fontSize: 15 }} />
          <Button accessibilityLabel="Search" onPress={searchDirectory} style={{ minWidth: 80 }}>Search</Button>
        </View>
        <LinearGradient colors={["#080808", "#171717", "#29150D"]}
          style={{ padding: compact ? 14 : 18, borderRadius: theme.radius.control, gap: 10 }}>
          <Text style={{ color: "#FF9A63", fontSize: 11, fontWeight: "800", letterSpacing: .8 }}>THE GLOBAL BASKETBALL INTELLIGENCE HUB</Text>
          <Text accessibilityRole="header" style={{ color: theme.entityHero.ink, fontFamily: "HoopCheckDisplay", fontSize: compact ? 27 : 30, lineHeight: compact ? 32 : 35 }}>Know who you’re signing with.</Text>
          <Text style={{ color: theme.entityHero.muted, fontSize: 15, lineHeight: 21 }}>Explore teams, coaches, leagues, and real basketball experiences. Built for players and fans worldwide.</Text>
          <View style={{ flexDirection: stack ? "column" : "row", gap: 8, marginTop: 4 }}>
            <Button accessibilityLabel="Create an account" onPress={() => router.push("/sign-up")} style={stack ? undefined : { flex: 3 }}>Create an account</Button>
            <Button secondary accessibilityLabel="Sign in" onPress={() => router.push("/sign-in")}
              style={{ ...(stack ? {} : { flex: 2 }), backgroundColor: "transparent", borderColor: theme.entityHero.muted }}>
              <Text style={{ color: theme.entityHero.ink, fontWeight: "800", textAlign: "center" }}>Sign in</Text>
            </Button>
          </View>
        </LinearGradient>
        <View style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.control }}>
          {([
            { label: "Live Games", icon: "basketball-outline", action: () => router.push("/fan-live") },
            { label: "Pre-sign check", icon: "shield-checkmark-outline", action: () => router.push({ pathname: "/web", params: { path: "/pre-sign" } }) },
          ] as const).map((item, index) => <Pressable key={item.label} accessibilityRole="button" onPress={item.action}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10,
              borderTopWidth: index ? 1 : 0, borderColor: theme.border, opacity: pressed ? .7 : 1 })}>
            <Ionicons name={item.icon} size={20} color={theme.accent} />
            <Text style={{ flex: 1, color: theme.foreground, fontSize: 15, fontWeight: "700" }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </Pressable>)}
        </View>
        <View style={{ marginTop: 4, gap: 8 }}><Text style={{ color: theme.accent, ...theme.type.caption }}>YOUR NEXT MOVE</Text><SectionHeader>Explore HoopCheck</SectionHeader><ExploreLinks publicOnly /></View>
        <Pressable accessibilityRole="link" onPress={() => router.push("/about")} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent }}>About HoopCheck™ →</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
