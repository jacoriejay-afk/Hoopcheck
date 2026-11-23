import { GlassCard } from "../components/glass/GlassCard";
import { GlassSegmented } from "../components/glass/GlassSegmented";
import { GlassHeader } from "../components/glass/GlassHeader";
import { GlassBackdrop } from "../components/glass/GlassBackdrop";
import { glassTokens as glass } from "../src/glassTheme";
import { Scoreboard } from "../components/Scoreboard";
import { Skeleton } from "../components/Motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SectionList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View, type ViewToken } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button, PressableCard } from "../src/primitives";
import { GameChat } from "../components/GameChat";
import { GamePrediction } from "../components/GamePrediction";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { requireOnline, useNetwork } from "../src/native/network";
import { GlassThemeScope, useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { readBasketballSide, readLiveGames, saveBasketballSide } from "../src/native/liveGames";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
type Games = Awaited<ReturnType<typeof readLiveGames>>;
const GAME_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 40 };
export default function LiveGames() { return <GlassThemeScope><LiveGamesContent /></GlassThemeScope>; }
function LiveGamesContent() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId?: string }>();
  const { account, loading: accountLoading, error: accountError, retry } = useNativeAccount();
  const { offline } = useNetwork();
  const active = useActiveScreen();
  const [visibleGames, setVisibleGames] = useState<Set<string>>(() => new Set());
  const onGamesViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const ids = new Set<string>();
    for (const viewable of viewableItems) {
      const id: unknown = viewable.item?.id;
      if (typeof id === "string" && viewable.isViewable) ids.add(id);
    }
    setVisibleGames(previous => {
      if (previous.size === ids.size && [...previous].every(id => ids.has(id))) return previous;
      return ids;
    });
  }, []);
  useFocusEffect(useCallback(() => { retry(); }, [retry]));
  const uid = account?.user.id;
  const [error, setError] = useState("");
  const [sideChoice, setSideChoice] = useState<{ owner: string; side: "mens" | "womens" } | null>(null);
  const side = sideChoice && sideChoice.owner === uid ? sideChoice.side : "mens";
  const [savingSide, setSavingSide] = useState(false);
  const [panel, setPanel] = useState<"chat" | "predictions">("chat");
  useEffect(() => { if (account?.user.accountType === "player" && !account.features.canUseLiveGameChat) setPanel("predictions"); }, [account?.user.accountType, account?.features.canUseLiveGameChat]);
  const allowed = Boolean(uid && !offline && (account.features.canUseLiveGameHub || account.user.accountType === "player"));
  const scope = `${uid ?? ""}:${side}`;
  useEffect(() => {
    if (!allowed || !uid) { setSideChoice(null); return; }
    let valid = true;
    void readBasketballSide(supabase, uid).then(value => { if (valid) setSideChoice({ owner: uid, side: value }); }).catch(() => { if (valid) setError("Game preferences could not load. Verify access again."); });
    return () => { valid = false; };
  }, [allowed, uid]);
  const viewer = useRef({ scope, allowed });
  useLayoutEffect(() => { viewer.current = { scope, allowed }; }, [scope, allowed]);
  const [snapshot, setSnapshot] = useState<{ scope: string; data: Games } | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [presenceCounts,setPresenceCounts]=useState<Record<string,number>>({});
  const [countryFocus,setCountryFocus]=useState("");
  const [leagueFocus,setLeagueFocus]=useState("");
  const [allGroups,setAllGroups]=useState(false);
  const [expandedGroups,setExpandedGroups]=useState<string[]>([]);
  useEffect(() => {
    if (!allowed || !uid || sideChoice?.owner !== uid || !active) { setSnapshot(null); return; }
    let valid = true, inFlight = false;
    const load = async () => {
      if (inFlight) return; inFlight = true; setLoading(true); setError("");
      try {
        const { data, error: authError } = await supabase.auth.getSession();
        if (authError || data.session?.user.id !== uid) throw new Error("Missing session");
        const games = await readLiveGames(supabase, side, account.features.canUseLiveGameHub ? null : { origin, token: data.session.access_token });
        if (valid && viewer.current.scope === scope && viewer.current.allowed) setSnapshot({ scope, data: games });
        // Presence counts are best-effort, never used to decide whether a game is LIVE.
        if (account.features.canUseLiveGameHub) {
          const recent = new Date(Date.now() - 75_000).toISOString();
          const present = await supabase.from("fan_live_chat_presence")
            .select("game_id").gt("last_seen_at", recent).limit(1500);
          if (valid && viewer.current.scope===scope && !present.error) {
            const ids=new Set(games.games.map(game=>game.id));
            const counts:Record<string,number>={};
            for (const row of present.data||[]) if(ids.has(row.game_id)) counts[row.game_id]=(counts[row.game_id]||0)+1;
            setPresenceCounts(counts);
          }
        } else if(valid) setPresenceCounts({});
      } catch { if (valid) { setSnapshot(null); setError("Live games could not load. Try again."); } }
      finally { inFlight = false; if (valid) setLoading(false); }
    };
    void load(); const timer = setInterval(() => void load(), 20000);
    return () => { valid = false; clearInterval(timer); };
  }, [allowed, uid, active, side, sideChoice?.owner, scope, revision, account?.features.canUseLiveGameHub]);
  const data = allowed && snapshot?.scope === scope ? snapshot.data : null;
  const game = typeof gameId === "string" ? data?.games.find(item => item.id === gameId) : undefined;
  const featuredGame = data?.games.find(item => item.status === "live") ?? data?.games.find(item => item.status === "final") ?? data?.games[0];
  const textStyle = { color: theme.foreground };
  if (accountLoading) return <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}><Skeleton /></View>;
  if (!allowed || !account) return <View style={{ flex: 1, backgroundColor: theme.background, padding: 24, gap: 16, justifyContent: "center" }}><Text style={{ color: theme.muted, fontSize: 13 }}>Live and upcoming games</Text><Text style={textStyle}>{offline ? "Reconnect to verify game access." : account ? "Live Games chat is available to eligible Pro and Premium members. Free players retain game predictions." : accountError}</Text><Button secondary onPress={retry}>Verify access again</Button><Button secondary onPress={() => router.push("/account")}>Your account</Button></View>;
  async function chooseSide(value: "mens" | "womens") {
    if (!account?.features.canSwitchBasketballSide || !uid || sideChoice?.owner !== uid || savingSide) return;
    setSavingSide(true); setError("");
    try {
      await requireOnline();
      const session = await supabase.auth.getSession();
      if (session.error || session.data.session?.user.id !== uid || !viewer.current.allowed) throw new Error("Session changed");
      await saveBasketballSide(supabase, uid, value);
      if (viewer.current.scope === scope) {setSideChoice({ owner: uid, side: value });setCountryFocus("");setLeagueFocus("");setExpandedGroups([]);setAllGroups(false);}
    } catch { if (viewer.current.scope === scope) setError("Basketball preference could not be saved. Try again."); }
    finally { setSavingSide(false); }
  }
  const discovery = (() => {
    const games = data?.games || [];
    const countries = new Map<string,number>();
    const leagues = new Map<string,number>();
    for(const game of games){
      const country=game.country||"Other countries", league=game.league_name||"Other leagues";
      countries.set(country,(countries.get(country)||0)+1);
      leagues.set(league,(leagues.get(league)||0)+1);
    }
    const popular=(map:Map<string,number>)=>[...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    return {countries:popular(countries),leagues:popular(leagues)};
  })();
  const leagueGroups = new Map<string, Games["games"]>();
  for (const item of data?.games ?? []) {
    const country=item.country||"Other countries",league=item.league_name||"Other leagues";
    if(countryFocus && country!==countryFocus) continue;
    if(leagueFocus && league!==leagueFocus) continue;
    const key = country + " / " + league;
    const rows=leagueGroups.get(key)||[];rows.push(item);leagueGroups.set(key,rows);
  }
  const rankedGroups=[...leagueGroups].sort(([a,ga],[b,gb])=>{
    const count=(rows:Games["games"])=>rows.reduce((n,g)=>n+(presenceCounts[g.id]||0),0);
    const live=(rows:Games["games"])=>rows.filter(g=>g.status==="live").length;
    return count(gb)-count(ga)||live(gb)-live(ga)||gb.length-ga.length||a.localeCompare(b);
  });
  const sections = (allGroups?rankedGroups:rankedGroups.slice(0,4)).map(([title,rows])=>({
    title, total:rows.length,
    chatting:rows.reduce((n,g)=>n+(presenceCounts[g.id]||0),0),
    data:expandedGroups.includes(title)?rows:rows.slice(0,3)
  }));
  const chatEnabled = active && account.features.canUseLiveGameChat && !offline;
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100} style={{ flex: 1, backgroundColor: theme.background }}>
    <GlassBackdrop screen="live" />
    <GlassHeader />
    <View style={{ padding: 12, gap: 8 }}>
      {!game ? <><View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={{ fontFamily: "HoopCheckDisplay", fontSize: 30, color: glass.foreground }}>LIVE GAMES</Text>
        <Text style={{ color: glass.secondary, fontSize: 13 }}>Scores, conversations and predictions.</Text>
      </View>
      {account.features.canSwitchBasketballSide ? <GlassSegmented value={side} options={[{ value: "mens", label: "Men" }, { value: "womens", label: "Women" }]} disabled={savingSide || sideChoice?.owner !== uid} onChange={value => void chooseSide(value)} /> : <Text style={{ color: theme.muted }}>{side === "mens" ? "Men’s basketball" : "Women’s basketball"}</Text>}</> : null}
      {error ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: theme.muted }}>{error}</Text><Button secondary onPress={retry}>Verify access again</Button></View> : null}
      {gameId ? <Button secondary onPress={() => router.replace("/fan-live")}>All games</Button> : null}
    </View>
    {game ? <View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 116, gap: 8 }}>
      <GlassCard><Scoreboard game={game} teams={data?.teams || {}} animateLive={active} /></GlassCard>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 20 }}>{(["chat", "predictions"] as const).map(value => <Pressable key={value} accessibilityRole="tab" aria-selected={panel === value} accessibilityState={{ selected: panel === value }} onPress={() => setPanel(value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: panel === value ? theme.accent : theme.foreground, fontWeight: "800" }}>{value === "chat" ? "Chat" : "Predictions"}</Text></Pressable>)}</View>
      {panel === "chat" ? <GameChat key={`${uid}:${game.id}`} gameId={game.id} userId={uid!} enabled={chatEnabled} active={active} /> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}><GamePrediction key={`${uid}:${game.id}`} game={game} userId={uid!} homeName={data?.teams[game.team_id]?.name || "Home team"} awayName={data?.teams[game.opponent_team_id || ""]?.name || game.opponent_name} active={active} /></ScrollView>}
    </View> : <SectionList sections={sections} stickySectionHeadersEnabled={false}
    viewabilityConfig={GAME_VIEWABILITY_CONFIG} onViewableItemsChanged={onGamesViewable} renderSectionHeader={({ section }) => <Text accessibilityRole="header" style={{ ...theme.type.section, color: theme.foreground, paddingVertical: theme.spacing.sm }}>{section.title} · {section.chatting} chatting</Text>}
    renderSectionFooter={({section})=>section.total>3?<Pressable accessibilityRole="button" onPress={()=>setExpandedGroups(current=>current.includes(section.title)?current.filter(item=>item!==section.title):[...current,section.title])}
      style={{minHeight:44,justifyContent:"center",alignItems:"center",borderWidth:1,borderColor:theme.border,borderRadius:14,marginTop:8,backgroundColor:theme.surface}}>
      <Text style={{color:theme.accent,fontWeight:"800"}}>{expandedGroups.includes(section.title)?"Show 3 games":`Show all ${section.total} games`}</Text>
    </Pressable>:null} keyExtractor={item => item.id} contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 145 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRevision(value => value + 1)} />} renderItem={({ item }) => <PressableCard accessibilityRole="button" onPress={() => router.push({ pathname: "/fan-live", params: { gameId: item.id } })}>
      <Scoreboard game={item} teams={data?.teams || {}} animateLive={active && visibleGames.has(item.id)} />
    </PressableCard>} ListHeaderComponent={<View style={{gap:10,marginBottom:12}}>
      {featuredGame ? <GlassCard testID="featured-live-game">
        <Text style={{ color: glass.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>FEATURED GAME</Text>
        <View style={{ marginTop: 9 }}><Scoreboard game={featuredGame} teams={data?.teams || {}} /></View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around",
          marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderColor: glass.border }}>
          <Text accessibilityLabel="Watch unavailable: no verified stream" style={{ color: glass.tertiary, fontSize: 12 }}>Watch</Text>
          <Pressable accessibilityRole="link" onPress={() => { setPanel("chat"); router.push({ pathname: "/fan-live", params: { gameId: featuredGame.id } }); }} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: glass.foreground, fontSize: 12, fontWeight: "700" }}>Game chat</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => { setPanel("predictions"); router.push({ pathname: "/fan-live", params: { gameId: featuredGame.id } }); }} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: glass.orange, fontSize: 12, fontWeight: "700" }}>Predict</Text>
          </Pressable>
        </View>
      </GlassCard> : null}
      <GlassCard solid radius={glass.radii.row} padding={12}>
        <Text style={{ color: glass.secondary, fontSize: 12, lineHeight: 18 }}>Scores are LIVE only when under 5 min old — everything else is a final.</Text>
      </GlassCard>
      <Text style={{fontSize:18,fontWeight:"900",color:theme.foreground}}>Browse by activity</Text>
      <Text style={{color:theme.muted,fontSize:12}}>Prioritized by members in chat, live status and available fixtures. The provider decides LIVE status.</Text>
      <Text style={{color:theme.foreground,fontWeight:"700"}}>Popular countries</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
        {[["","All countries"],...discovery.countries.slice(0,6).map(([name,count])=>[name,`${name} (${count})`])].map(([value,label])=><Pressable key={value||"all"} accessibilityRole="button" accessibilityState={{selected:countryFocus===value}} onPress={()=>{setCountryFocus(value);setLeagueFocus("");setExpandedGroups([]);}} style={{paddingHorizontal:12,minHeight:44,justifyContent:"center",borderRadius:14,borderWidth:1,borderColor:countryFocus===value?theme.accent:theme.border,backgroundColor:countryFocus===value?theme.accentSurface:theme.surface}}><Text style={{color:theme.foreground,fontSize:12,fontWeight:"700"}}>{label}</Text></Pressable>)}
      </ScrollView>
      <Text style={{color:theme.foreground,fontWeight:"700"}}>Popular leagues</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
        {[["","All leagues"],...discovery.leagues.slice(0,6).map(([name,count])=>[name,`${name} (${count})`])].map(([value,label])=><Pressable key={value||"all"} accessibilityRole="button" accessibilityState={{selected:leagueFocus===value}} onPress={()=>{setLeagueFocus(value);setExpandedGroups([]);}} style={{paddingHorizontal:12,minHeight:44,justifyContent:"center",borderRadius:14,borderWidth:1,borderColor:leagueFocus===value?theme.accent:theme.border,backgroundColor:leagueFocus===value?theme.accentSurface:theme.surface}}><Text style={{color:theme.foreground,fontSize:12,fontWeight:"700"}}>{label}</Text></Pressable>)}
      </ScrollView>
      {rankedGroups.length>4?<Button secondary onPress={()=>setAllGroups(value=>!value)}>{allGroups?"Show compact groups":`Show all ${rankedGroups.length} country / league groups`}</Button>:null}
      {gameId&&!loading?<Text style={{color:theme.muted}}>Requested game unavailable in this basketball side. Choose a game or switch sides.</Text>:null}
    </View>} ListEmptyComponent={loading ? <Skeleton /> : <View style={{ gap: 12 }}><Text style={textStyle}>{error || "No current games are available."}</Text><Button secondary onPress={() => setRevision(value => value + 1)}>Refresh games</Button></View>} />}
  </KeyboardAvoidingView>;
}
