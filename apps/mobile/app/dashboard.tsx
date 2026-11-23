import { HomeCourtside, HomeStagger } from "../components/HomeCourtside";
import { PressableScale } from "../components/PressableScale";
import { RoleHub } from "../components/RoleHub";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { GlassSurface } from "../components/GlassSurface";
import { BrandLogo } from "../components/BrandLogo";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { Input, Chip, SectionHeader } from "../src/primitives";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
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
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const { account: currentAccount, loading: accountLoading } = useNativeAccount();
  const insets = useSafeAreaInsets();
  const reduced = useMotionSetting();
  const scrollY = useSharedValue(0);
  // Only a worklet handles scrolling. Reserve the full header footprint below.
  const onHomeScroll = useAnimatedScrollHandler({
    onScroll: event => { scrollY.value = event.contentOffset.y; },
  });
  const headerStyle = useAnimatedStyle(() => ({
    height: insets.top + (reduced ? (scrollY.value > 55 ? 54 : 86) :
      interpolate(scrollY.value, [0, 100], [86, 54], Extrapolation.CLAMP)),
  }));
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: reduced ? (scrollY.value > 55 ? 0 : 1) :
      interpolate(scrollY.value, [0, 65], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: reduced ? 1 :
      interpolate(scrollY.value, [0, 100], [1, 0.83], Extrapolation.CLAMP) }],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: reduced ? (scrollY.value > 55 ? 1 : 0) :
      interpolate(scrollY.value, [35, 90], [0, 1], Extrapolation.CLAMP),
  }));
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
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      <Animated.ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
        testID="dashboard-scroll" onScroll={onHomeScroll} scrollEventThrottle={16}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 86 + 12 }]}>
        <View style={styles.content}>
          <GlassSurface style={{ flexDirection:"row",alignItems:"center",marginBottom:14,
            borderRadius:17,paddingLeft:12,paddingRight:5,minHeight:50,
            backgroundColor:theme.dark?"#1A2940":"#FFFFFF",
            borderColor:theme.dark?"rgba(113,173,236,.42)":theme.border }}>
            <Ionicons name="search-outline" size={21} color={theme.accent} />
            <Input style={{ flex:1,minWidth:0,backgroundColor:"transparent",
              borderWidth:0,fontSize:14,color:theme.foreground }}
              accessibilityLabel="Search basketball directory"
              placeholder="Search players, coaches, teams, or leagues…" value={search}
              maxLength={100} onChangeText={setSearch} returnKeyType="search"
              onSubmitEditing={()=>router.push({pathname:"/search",params:{q:search}})} />
            <Pressable accessibilityRole="button" accessibilityLabel="Search"
              onPress={()=>router.push({pathname:"/search",params:{q:search}})}
              style={({pressed})=>({minHeight:44,minWidth:44,borderRadius:13,
                backgroundColor:theme.accentSurface,justifyContent:"center",alignItems:"center",
                opacity:pressed?.72:1})}>
              <Ionicons name="arrow-forward" size={20} color={theme.accent} />
            </Pressable>
          </GlassSurface>
          <HomeCourtside />
          {!accountLoading && currentAccount ? <>
            <HomeStagger index={7}><RoleHub /></HomeStagger>
            <HomeStagger index={8}>
              <View style={{ gap: 10 }}>
                <SectionHeader>Explore basketball</SectionHeader>
                <View style={styles.directories}><HomeExploreLinks /></View>
              </View>
            </HomeStagger>
          </> : null}

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
      </Animated.ScrollView>
      <Animated.View testID="home-sticky-header" style={[styles.stickyHeader,
        { backgroundColor: theme.surface, borderBottomColor: theme.border }, headerStyle]}>
        <Animated.View pointerEvents="none" style={[styles.expandedBrand, { top: insets.top + 17 }, expandedStyle]}>
          <BrandLogo />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.compactBrand, { top: insets.top + 10 }, compactStyle]}>
          <BrandLogo compact />
          <Text style={{ color: theme.foreground, fontSize: 16, fontWeight: "800" }}>HoopCheck</Text>
        </Animated.View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open account menu"
          onPress={() => router.push("/account")}
          style={({ pressed }) => [styles.headerMenu, { top: insets.top + 8,
            borderColor: theme.border, backgroundColor: theme.elevatedSurface,
            opacity: pressed ? .75 : 1 }]}>
          <Ionicons name="menu" size={24} color={theme.foreground} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: 12 },
  stickyHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
    borderBottomWidth: 1, overflow: "hidden", elevation: 5 },
  expandedBrand: { position: "absolute", left: 12, height: 46, justifyContent: "center",
    alignItems: "flex-start" },
  compactBrand: { position: "absolute", left: 12, height: 34,
    flexDirection: "row", gap: 7, alignItems: "center" },
  headerMenu: { position: "absolute", right: 12, width: 44, height: 44, borderRadius: 12,
    borderWidth: 1, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: 640, alignSelf: "center" },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -0.7, marginBottom: 16 },
  directories: { gap: 8, marginTop: 12 },
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

const homeExplore = [
  { href: "/teams", title: "Teams", detail: "Research teams before you sign", icon: "basketball-outline" },
  { href: "/womens", title: "Women’s teams", detail: "Explore women’s basketball", icon: "people-outline" },
  { href: "/coaches", title: "Coaches", detail: "Check coaching reputations", icon: "school-outline" },
  { href: "/leagues", title: "Leagues", detail: "Compare competitions", icon: "trophy-outline" },
  { href: "/players", title: "Players", detail: "Discover basketball players", icon: "person-outline" },
  { href: "/team-hub/groups", title: "HoopGroups", detail: "Find your club’s fan community", icon: "people-outline" },
  { href: "/fan-live", title: "Live Games", detail: "Games, chat and predictions", icon: "radio-outline" },
  { href: "/feed", title: "HoopFeed", detail: "Community, comments and Reels", icon: "basketball-outline" },
] as const;

/** Home-only rows; public/shared ExploreLinks remains untouched. */
function HomeExploreLinks() {
  const theme = useEntryTheme();
  const router = useRouter();
  return <View style={{ gap: theme.spacing.sm }}>{homeExplore.map(item =>
    <PressableScale key={item.href} accessibilityRole="link"
      testID={`directory-${item.title.toLowerCase()}`}
      accessibilityLabel={item.title} onPress={() => router.push(item.href)}
      style={{ flexDirection: "row", alignItems: "center", minHeight: 70,
        padding: theme.spacing.md, gap: theme.spacing.md, borderRadius: theme.radius.control,
        borderCurve: "continuous", borderWidth: 1, borderColor: theme.border,
        backgroundColor: theme.surface }}>
      <View style={{ width: 44, height: 44, borderRadius: theme.radius.control,
        alignItems: "center", justifyContent: "center", backgroundColor: theme.accentSurface }}>
        <Ionicons name={item.icon} size={22} color={theme.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={{ color: theme.foreground, ...theme.type.section }}>{item.title}</Text>
        <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 17 }}>{item.detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.foreground} />
    </PressableScale>
  )}</View>;
}
