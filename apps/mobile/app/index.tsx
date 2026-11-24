import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArenaBrand } from "../components/ArenaBrand";
import { ExploreLinks } from "../components/ExploreLinks";
import { Button, Input, SectionHeader } from "../src/primitives";
import { useEntryTheme } from "../src/theme";

export default function WelcomeScreen() {
  const theme = useEntryTheme(); const router = useRouter(); const [search, setSearch] = useState("");
  const searchDirectory = () => router.push({ pathname: "/search", params: { q: search } });
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <LinearGradient colors={["#081427","#183C5D","#2C1C2A"]}
        start={{x:0,y:0}} end={{x:1,y:1}}
        style={{borderRadius:18,paddingVertical:16,borderWidth:1,borderColor:"#FF7C36"}}>
        <ArenaBrand size={84} compact />
      </LinearGradient>
      <View style={{ gap: theme.spacing.sm, padding: theme.spacing.sm, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius.control }}>
        <Input accessibilityLabel="Search basketball directory" placeholder="Search teams, leagues, coaches or players" value={search} maxLength={100} onChangeText={setSearch} returnKeyType="search" onSubmitEditing={searchDirectory} />
        <Button onPress={searchDirectory}>Search</Button>
      </View>
      <LinearGradient colors={["#080808", "#171717", "#29150D"]} style={{ padding: theme.spacing.lg, borderRadius: theme.radius.control, gap: theme.spacing.lg }}>
        <Text style={{ color: theme.button, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>THE GLOBAL BASKETBALL INTELLIGENCE HUB</Text>
        <Text accessibilityRole="header" style={{ color: theme.entityHero.ink, fontFamily: "HoopCheckDisplay", fontSize: 32, lineHeight: 34 }}>Know who you’re signing with.</Text>
        <Text style={{ color: theme.entityHero.muted, fontSize: 15, lineHeight: 21 }}>Explore teams, coaches, leagues, and real basketball experiences. Built for players and fans worldwide.</Text>
        <Button accessibilityLabel="Create an account" onPress={() => router.push("/sign-up")}>Create an account</Button>
        <Button secondary accessibilityLabel="Sign in" onPress={() => router.push("/sign-in")} style={{ backgroundColor: "transparent", borderColor: theme.entityHero.muted }}><Text style={{ color: theme.entityHero.ink, fontWeight: "800" }}>Sign in</Text></Button>
      </LinearGradient>
      <Button secondary onPress={() => router.push("/fan-live")}>Live Games · Open hub →</Button>
      <Button secondary onPress={() => router.push({ pathname: "/web", params: { path: "/pre-sign" } })}>Pre-sign check →</Button>
      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}><Text style={{ color: theme.accent, ...theme.type.caption }}>YOUR NEXT MOVE</Text><SectionHeader>Explore HoopCheck</SectionHeader><ExploreLinks publicOnly /></View>
      <Pressable accessibilityRole="link" onPress={() => router.push("/about")} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent }}>About HoopCheck™ →</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}
