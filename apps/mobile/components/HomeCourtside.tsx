import { CourtsideBanner } from "./CourtsideBanner";
import { GlassSurface } from "./GlassSurface";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { PressableCard, SectionHeader, Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { supabase } from "../src/lib/supabase";
import { visibleConnections, type PublicConnection } from "../src/native/connectionPresentation";
import { readBasketballSide, readLiveGames } from "../src/native/liveGames";
import { readFeedPage, type FeedPost } from "../src/native/feedClient";
import { Reveal, Skeleton } from "./Motion";
import { Scoreboard } from "./Scoreboard";
import { EntityArtwork } from "./EntityArtwork";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
type Games = Awaited<ReturnType<typeof readLiveGames>>;
type HomeData = { scope: string; teams: PublicConnection[] | null; games: Games | null; posts: FeedPost[] | null };
export function HomeCourtside() {
  const t = useEntryTheme(); const router = useRouter();
  const { account, loading, error, retry } = useNativeAccount();
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<HomeData | null>(null);
  const uid = account?.user.id;
  const role = account?.user.accountType;
  const gameAccess = Boolean(account?.features.canUseLiveGameHub || role === "player");
  const feedAccess = account?.features.canReadHoopFeed === true;
  const fullGames = account?.features.canUseLiveGameHub === true;
  const scope = `${uid}:${role}:${gameAccess}:${feedAccess}:${fullGames}`;
  useFocusEffect(useCallback(() => {
    void revision; // A user refresh starts a new focused request.
    let active = true; const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setSnapshot(null);
    async function load() {
      if (!uid || !role) return;
      try {
        const before = await supabase.auth.getSession();
        if (before.error || before.data.session?.user.id !== uid) throw Error("Session changed");
        const token = before.data.session.access_token;
        const results = await Promise.allSettled([
          supabase.rpc("get_public_follow_list", { p_mode: "following", p_target_type: null, p_target_id: null, p_user_id: uid }).abortSignal(controller.signal).then(result => { if (result.error) throw Error("Teams unavailable"); return visibleConnections(result.data, role).filter(row => row.target_type === "team"); }),
          gameAccess ? readBasketballSide(supabase, uid).then(side => readLiveGames(supabase, side, fullGames ? null : { origin, token })) : Promise.resolve(null),
          feedAccess ? readFeedPage(supabase, uid).then(page => page.posts.slice(0, 2)) : Promise.resolve(null),
        ]);
        const after = await supabase.auth.getSession();
        if (!active) return;
        if (controller.signal.aborted || after.error || after.data.session?.user.id !== uid) throw Error("Home could not be verified");
        setSnapshot({ scope, teams: results[0].status === "fulfilled" ? results[0].value : null, games: results[1].status === "fulfilled" ? results[1].value : null, posts: results[2].status === "fulfilled" ? results[2].value : null });
      } catch { if (active) setSnapshot({ scope, teams: null, games: null, posts: null }); }
      finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [uid, role, scope, revision, gameAccess, feedAccess, fullGames]));
  const data = account && snapshot?.scope === scope ? snapshot : null;
  const action = (route: "/feed" | "/fan-live" | "/team-hub/groups" | "/reels", label: string) => <Button secondary onPress={() => router.push(route)}>{label}</Button>;
  if (loading) return <Skeleton review />;
  if (!account) return <View style={{ gap: t.spacing.sm }}><Text accessibilityRole="alert" style={{ color: t.muted }}>{error || "Verify your account to personalize Home."}</Text><Button secondary onPress={retry}>Retry account verification</Button></View>;
  return <View style={{ gap: t.courtside.sectionGap, marginBottom: t.spacing.xl }}>
    <Reveal><CourtsideBanner eyebrow="YOUR COURTSIDE" title={account.user.displayName ? `Welcome, ${account.user.displayName}` : "Welcome to courtside"}>Your teams. Your game. Your community.</CourtsideBanner></Reveal>
    <View style={{ flexDirection: "row", gap: 9 }}>
      {([
        { route: "/fan-live", label: "Game Center", subtitle: "LIVE & NEXT", icon: "flash" },
        { route: "/team-hub/groups", label: "HoopGroups", subtitle: "YOUR PEOPLE", icon: "people" },
        { route: "/reels", label: "Highlight Hub", subtitle: "WATCH & SHARE", icon: "play" },
      ] as const).map(item => <Pressable key={item.route} accessibilityRole="link"
        accessibilityLabel={item.label} onPress={() => router.push(item.route as "/feed")}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? .72 : 1 })}>
        <GlassSurface native={false} style={{
          minHeight: 116, borderRadius: 22, padding: 12, gap: 12,
          justifyContent: "space-between",
        }} intensity={35}>
          <View style={{ width: 36, height: 36, borderRadius: 14, backgroundColor: t.accentSurface,
            justifyContent: "center", alignItems: "center" }}>
            <Ionicons name={item.icon} color={t.accent} size={19} />
          </View>
          <View style={{ gap: 4 }}>
            <Text numberOfLines={1} style={{ color: t.foreground, fontWeight: "800", fontSize: 12 }}>{item.label}</Text>
            <Text numberOfLines={1} style={{ color: t.muted, fontWeight: "800", fontSize: 9,
              letterSpacing: .6 }}>{item.subtitle}</Text>
          </View>
        </GlassSurface>
      </Pressable>)}
    </View>
    {!data ? <Skeleton /> : <>
      <SectionHeader>Live &amp; upcoming</SectionHeader>
      {!gameAccess ? <Text style={{ color: t.muted }}>Game Center is available with eligible memberships.</Text> : data.games === null ? <Text accessibilityRole="alert" style={{ color: t.muted }}>Scores could not load.</Text> : !data.games.games.length ? <Text style={{ color: t.muted }}>No current games. Check back for the next tip-off.</Text> : [...data.games.games].sort((a, b) => Number(b.status === "live") - Number(a.status === "live")).slice(0, 3).map(game => <PressableCard key={game.id} onPress={() => router.push({ pathname: "/fan-live", params: { gameId: game.id } })}><Scoreboard game={game} teams={data.games!.teams} /></PressableCard>)}
      {action("/fan-live", "All games")}
      <SectionHeader>My Teams</SectionHeader>
      {data.teams === null ? <Text accessibilityRole="alert" style={{ color: t.muted }}>Your teams could not load.</Text> : !data.teams.length ? <View style={{ gap: t.spacing.sm }}><Text style={{ color: t.muted }}>Follow a team to keep your basketball network close.</Text><Button secondary onPress={() => router.push("/teams")}>Find teams</Button></View> : data.teams.slice(0, 4).map(team => <PressableCard key={team.target_id} accessibilityRole="link" onPress={() => router.push({ pathname: "/teams/[id]", params: { id: team.target_id } })}><View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md }}><EntityArtwork name={team.display_name || "Team"} kind="teams" size={40} /><Text style={{ flex: 1, color: t.foreground, ...t.type.section }}>{team.display_name || "Team"}</Text><Text style={{ color: t.accent }}>View</Text></View></PressableCard>)}
      <SectionHeader>From HoopFeed</SectionHeader>
      {!feedAccess ? <Text style={{ color: t.muted }}>Verify your membership to read community posts.</Text> : data.posts === null ? <Text accessibilityRole="alert" style={{ color: t.muted }}>HoopFeed preview could not load.</Text> : !data.posts.length ? <Text style={{ color: t.muted }}>No community posts available yet.</Text> : data.posts.map(post => <PressableCard key={post.id} onPress={() => router.push({ pathname: "/feed", params: { post: post.id } })}><Text style={{ color: t.muted, ...t.type.caption }}>{post.profiles?.display_name || "HoopCheck member"} · {new Date(post.created_at).toLocaleDateString()}</Text><Text numberOfLines={3} style={{ color: t.foreground, ...t.type.body }}>{post.body || (post.video_url ? "Watch a community highlight" : "View community media")}</Text></PressableCard>)}
      {action("/feed", "Open HoopFeed")}
      <Button secondary onPress={() => setRevision(value => value + 1)}>Refresh courtside</Button>
    </>}
  </View>;
}
