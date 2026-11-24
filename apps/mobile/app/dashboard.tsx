import { HomeCourtside } from "../components/HomeCourtside";
import { RoleHub } from "../components/RoleHub";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { GlassSurface } from "../components/GlassSurface";
import { BrandLogo } from "../components/BrandLogo";
import { ExploreLinks } from "../components/ExploreLinks";
import { Input, Chip, SectionHeader } from "../src/primitives";
import { useCallback, useEffect, useState } from "react";
import { Alert, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";

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
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const reduced = useMotionSetting();
  const closeSearch = useCallback(() => { setSearchOpen(false); Keyboard.dismiss(); }, []);
  useFocusEffect(useCallback(() => () => { closeSearch(); setMenuOpen(false); }, [closeSearch]));
  const submitSearch = () => { closeSearch(); router.push({ pathname: "/search", params: { q: search } }); };
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const { account: currentAccount } = useNativeAccount();
  // Display the verified profile role, not editable auth metadata.
  const accountType = currentAccount?.user.accountType.replaceAll("_", " ") || "";

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!alive || error) return;
      setEmail(data.user?.email ?? "");

    });
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
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Overlay the scrolling screen, without a dedicated opaque header row. */}
      <View pointerEvents="box-none" style={[styles.pinnedHeader, { top: insets.top + 4 }]}>
          <GlassSurface navigation style={{borderRadius:28,borderWidth:0}}>
            {searchOpen ? <Animated.View entering={reduced ? undefined : FadeIn.duration(150)} style={{ minHeight:54, paddingHorizontal:8, flexDirection:"row", alignItems:"center", gap:4 }}>
              <Ionicons name="search-outline" size={21} color={theme.accent} />
              <Input autoFocus accessibilityLabel="Search basketball directory" placeholder="Search basketball…" value={search} maxLength={100} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onChangeText={setSearch} onSubmitEditing={submitSearch}
                style={{ flex:1, minWidth:0, paddingHorizontal:4, backgroundColor:"transparent", borderWidth:0, fontSize:14 }} />
              <Pressable accessibilityRole="button" accessibilityLabel="Show search results" onPress={submitSearch} style={{ width:44, height:44, justifyContent:"center", alignItems:"center" }}><Ionicons name="arrow-forward" size={20} color={theme.accent}/></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel search" onPress={closeSearch} style={{ minHeight:44, minWidth:44, justifyContent:"center", alignItems:"center" }}><Ionicons name="close" size={23} color={theme.foreground}/></Pressable>
            </Animated.View> : <Animated.View entering={reduced ? undefined : FadeIn.duration(150)} style={{minHeight:54,paddingHorizontal:12,paddingVertical:5,
              flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <View style={{ flex:1, minWidth:0 }}><BrandLogo onHero={theme.dark} /></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={()=>{ setMenuOpen(false); setSearchOpen(true); }} style={{ width:44, height:44, justifyContent:"center", alignItems:"center" }}><Ionicons name="search-outline" size={23} color={theme.foreground}/></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Open account menu"
                accessibilityState={{expanded:menuOpen}} onPress={()=>setMenuOpen(open=>!open)}
                style={({pressed})=>({width:44,height:44,borderRadius:19,
                  borderWidth:menuOpen?1:0,borderColor:theme.accent,
                  backgroundColor:menuOpen?theme.accentSurface:"transparent",
                  alignItems:"center",justifyContent:"center",opacity:pressed?.72:1})}>
                <Ionicons name={menuOpen?"close":"menu"} size={25} color={theme.dark?"#FFFFFF":theme.foreground} />
              </Pressable>
            </Animated.View>}
          </GlassSurface>
          {menuOpen && !searchOpen ? <GlassSurface style={{
            position:"absolute",right:12,top:61,width:232,zIndex:30,
            padding:6,borderRadius:18,borderColor:theme.glassBorder,
            shadowColor:"#000",shadowOpacity:.3,shadowRadius:14,shadowOffset:{width:0,height:8},
          }}>
            {([
              {label:"My account",path:"/account",icon:"person-circle-outline"},
              {label:"HoopChat",path:"/messages",icon:"chatbubbles-outline"},
              {label:"HoopGroups",path:"/hoopgroups",icon:"people-outline"},
              {label:"Settings",path:"/settings",icon:"settings-outline"},
              {label:"About HoopCheck",path:"/about",icon:"help-circle-outline"},
            ] as const).map(item=><Pressable key={item.path} accessibilityRole="menuitem"
              accessibilityLabel={item.label} onPress={()=>{setMenuOpen(false); if(item.label==="HoopChat") router.push({pathname:"/notifications",params:{tab:"chat"}}); else router.push(item.path);}}
              style={({pressed})=>({flexDirection:"row",alignItems:"center",gap:10,minHeight:47,
                paddingHorizontal:12,borderRadius:12,backgroundColor:pressed?theme.accentSurface:"transparent"})}>
              <Ionicons name={item.icon} size={19} color={theme.accent}/>
              <Text style={{color:theme.foreground,fontWeight:"700",fontSize:14}}>{item.label}</Text>
            </Pressable>)}
          </GlassSurface> : null}
      </View>
      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onScrollBeginDrag={()=>setMenuOpen(false)} scrollEnabled={!searchOpen} testID="dashboard-scroll" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <HomeCourtside />
          <RoleHub />
          <SectionHeader>Explore basketball</SectionHeader>
          <View style={styles.directories}><ExploreLinks compact /></View>

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
  pinnedHeader: { position: "absolute", width: "100%", maxWidth: 664, alignSelf: "center", paddingHorizontal: 17, zIndex: 20 },
  scroll: { flexGrow: 1, padding: 12, paddingTop: 72, paddingBottom: 100 },
  content: { width: "100%", maxWidth: 640, alignSelf: "center" },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -0.7, marginBottom: 16 },
  directories: { gap: 8, marginTop: 6 },
  directory: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  directoryCopy: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: "800" },
  detail: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  account: { borderWidth: 1, overflow: "hidden" },
  identity: { padding: 14, gap: 4 },
  role: { fontSize: 14, textTransform: "capitalize" },
  accountLink: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
  signOut: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 12 },
});
