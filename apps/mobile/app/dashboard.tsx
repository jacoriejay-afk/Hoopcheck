import { HomeCourtside } from "../components/HomeCourtside";
import { GlassSurface } from "../components/GlassSurface";
import { ExploreLinks } from "../components/ExploreLinks";
import { Input, Chip, SectionHeader } from "../src/primitives";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";

const roleShortcuts: Record<string, {title:string;description:string;links:{path: "/account"|"/teams"|"/players"|"/fan-live"|"/messages"|"/feed"|"/leagues"|"/team-hub/groups";label:string}[]}> = {
  player: {title:"Player courtside",description:"Your career and basketball network",links:[{path:"/account",label:"My profile"},{path:"/teams",label:"Research clubs"},{path:"/messages",label:"HoopChat"},{path:"/fan-live",label:"Live games"}]},
  fan: {title:"Fan courtside",description:"Your clubs and game-day conversations",links:[{path:"/fan-live",label:"Live games"},{path:"/team-hub/groups",label:"Team Fan Groups"},{path:"/teams",label:"Discover teams"},{path:"/feed",label:"HoopFeed"}]},
  coach: {title:"Coach courtside",description:"Professional basketball network",links:[{path:"/players",label:"Discover players"},{path:"/leagues",label:"Leagues"},{path:"/teams",label:"Clubs"},{path:"/messages",label:"Messages"}]},
  agent: {title:"Agent courtside",description:"Find talent and research opportunities",links:[{path:"/players",label:"Find talent"},{path:"/leagues",label:"Leagues"},{path:"/messages",label:"Contacts"},{path:"/account",label:"My account"}]},
  manager: {title:"Team manager courtside",description:"Your club and supporters",links:[{path:"/teams",label:"Team directory"},{path:"/team-hub/groups",label:"Fan Groups"},{path:"/messages",label:"Messages"},{path:"/account",label:"My account"}]},
};
roleShortcuts.scout = {...roleShortcuts.agent,title:"Scout courtside"};
roleShortcuts.club_admin = roleShortcuts.manager;

const accountLinks = [
  { path: "/about", label: "About HoopCheck" },
  { path: "/account", label: "Account settings" },
  { path: "/support", label: "Support" },
  { path: "/terms", label: "Terms of Service" },
  { path: "/privacy", label: "Privacy Policy" },
  { path: "/community-guidelines", label: "Community Guidelines" },
  { path: "/privacy-center", label: "Privacy Request Center" },
];

export default function DashboardScreen() {
  const router = useRouter();
  const theme = useEntryTheme();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (!alive || error || !data.user) return;
      setEmail(data.user.email ?? "");
      // Profile role is authoritative for presentation; editable auth metadata is not.
      const profile = await supabase.from("profiles").select("account_type").eq("id",data.user.id).maybeSingle();
      if (alive && !profile.error && typeof profile.data?.account_type === "string") setAccountType(profile.data.account_type);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function openAccountLink(path: string) {
    if (path === "/account" || path === "/about") { router.push(path); return; }
    try {
      await Linking.openURL(`https://hoopcheck.online${path}`);
    } catch {
      Alert.alert("Unable to open link", "Please try again or visit hoopcheck.online in your browser.");
    }
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) {
      Alert.alert("Could not sign out", error.message);
      return;
    }
    router.replace("/");
  }

  const panel = { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: theme.cardRadius };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" testID="dashboard-scroll" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={{ flexDirection: "row", alignItems: "center",
            justifyContent: "space-between", paddingVertical: 13, gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "900", letterSpacing: 2.2 }}>THE COURTSIDE</Text>
              <Text accessibilityRole="header" style={{ fontFamily: "HoopCheckDisplay",
                fontSize: 34, lineHeight: 36, color: theme.foreground }}>Your game. Your world.</Text>
            </View>
            <GlassSurface style={{ width: 48, height: 48, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="basketball" size={23} color={theme.accent} />
            </GlassSurface>
          </View>
          <GlassSurface style={{ flexDirection: "row", alignItems: "center", marginTop: 4,
            marginBottom: 23, borderRadius: 20, paddingLeft: 15, paddingRight: 5 }}>
            <Ionicons name="search-outline" size={21} color={theme.accent} />
            <Input style={{ flex: 1, minWidth: 0, backgroundColor: "transparent", borderWidth: 0,
              fontSize: 15 }} accessibilityLabel="Search basketball directory" placeholder="Search players, teams, leagues…" value={search}
              maxLength={100} onChangeText={setSearch} returnKeyType="search"
              onSubmitEditing={() => router.push({ pathname: "/search", params: { q: search } })} />
            <Pressable accessibilityRole="button" accessibilityLabel="Search"
              onPress={() => router.push({ pathname: "/search", params: { q: search } })}
              style={({ pressed }) => ({
                minHeight: 44, minWidth: 44, borderRadius: 15,
                backgroundColor: theme.accentSurface, justifyContent: "center", alignItems: "center",
                opacity: pressed ? .72 : 1,
              })}>
              <Ionicons name="arrow-forward" size={20} color={theme.accent} />
            </Pressable>
          </GlassSurface>
          <HomeCourtside />
          <GlassSurface style={{padding:14,marginBottom:16,borderRadius:20,gap:10}}>
            <Text style={{color:theme.foreground,fontWeight:"900",fontSize:19}}>{(roleShortcuts[accountType]||roleShortcuts.fan).title}</Text>
            <Text style={{color:theme.muted,fontSize:13}}>{(roleShortcuts[accountType]||roleShortcuts.fan).description}</Text>
            <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
              {(roleShortcuts[accountType]||roleShortcuts.fan).links.map(item=><Pressable key={item.path} accessibilityRole="button" onPress={()=>router.push(item.path)} style={{minHeight:44,justifyContent:"center",paddingVertical:10,paddingHorizontal:12,borderRadius:14,backgroundColor:theme.accentSurface,borderWidth:1,borderColor:theme.border}}>
                <Text style={{color:theme.foreground,fontWeight:"700",fontSize:13}}>{item.label}</Text>
              </Pressable>)}
            </View>
          </GlassSurface>
          <SectionHeader>Explore basketball</SectionHeader>
          <View style={styles.directories}><ExploreLinks /></View>

          <View style={styles.sectionTitle}><SectionHeader>Account &amp; support</SectionHeader></View>
          <View style={[styles.account, panel]}>
            {email ? (
              <View style={styles.identity}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>{email}</Text>
                {accountType ? <View style={{ alignSelf: "flex-start" }}><Chip>{accountType}</Chip></View> : null}
              </View>
            ) : null}
            {accountLinks.map(({ path, label }, index) => (
              <Pressable key={path} accessibilityRole="link" onPress={() => void openAccountLink(path)}
                style={({ pressed }) => [
                  styles.accountLink,
                  (index > 0 || Boolean(email)) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                  pressed && { backgroundColor: theme.accentSurface },
                ]}>
                <Text style={[styles.linkLabel, { color: theme.foreground }]}>{label}</Text>
                <Ionicons name="open-outline" size={17} color={theme.accent} />
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} onPress={signOut} disabled={busy}
            style={({ pressed }) => [styles.signOut, (pressed || busy) && { opacity: 0.65 }]}>
            <Text style={[styles.rowLabel, { color: theme.accent }]}>{busy ? "Signing out…" : "Sign out"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16 },
  content: { width: "100%", maxWidth: 640, alignSelf: "center" },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -0.7, marginBottom: 16 },
  directories: { gap: 8, marginTop: 12 },
  directory: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  directoryCopy: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: "800" },
  detail: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  sectionTitle: { fontSize: 21, fontWeight: "800", marginTop: 28, marginBottom: 10 },
  account: { borderWidth: 1, overflow: "hidden" },
  identity: { padding: 14, gap: 4 },
  role: { fontSize: 14, textTransform: "capitalize" },
  accountLink: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
  signOut: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 12 },
});
