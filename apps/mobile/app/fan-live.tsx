import { GlassSurface } from "../components/GlassSurface";
import { Scoreboard } from "../components/Scoreboard";
import { HoopCheckLoading } from "../components/HoopCheckLoading";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SectionList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "../src/primitives";
import { GameChat } from "../components/GameChat";
import { GamePrediction } from "../components/GamePrediction";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { requireOnline, useNetwork } from "../src/native/network";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { readBasketballSide, readLiveGames, saveBasketballSide } from "../src/native/liveGames";
import { gameDisplayState, lastCheckedLabel } from "../src/native/gameFreshness";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
type Games = Awaited<ReturnType<typeof readLiveGames>>;
export default function LiveGames() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { gameId, side: requestedSide } = useLocalSearchParams<{ gameId?: string; side?: string }>();
  const { account, loading: accountLoading, error: accountError, retry } = useNativeAccount();
  const { offline } = useNetwork();
  const active = useActiveScreen();
  useFocusEffect(useCallback(() => { retry(); }, [retry]));
  const uid = account?.user.id;
  const [error, setError] = useState("");
  const [sideChoice, setSideChoice] = useState<{ owner: string; side: "mens" | "womens" } | null>(null);
  const side = sideChoice && sideChoice.owner === uid ? sideChoice.side : "mens";
  const [savingSide, setSavingSide] = useState(false);
  const [panel, setPanel] = useState<"chat" | "predictions">("chat");
  useEffect(() => { if (account?.user.accountType === "player" && !account.features.canUseLiveGameChat) setPanel("predictions"); }, [account?.user.accountType, account?.features.canUseLiveGameChat]);
  const allowed = Boolean(uid && !offline && (account.features.canUseLiveGameHub || account.user.accountType === "player"));
  const scope = `${uid ?? ""}:${side}:${account?.features.canUseLiveGameHub ? "hub" : "predictions"}`;
  useEffect(() => {
    if (!allowed || !uid) { setSideChoice(null); return; }
    let valid = true;
    void readBasketballSide(supabase, uid).then(value => { if (valid) setSideChoice({ owner: uid, side: account?.features.canSwitchBasketballSide && (requestedSide === "mens" || requestedSide === "womens") ? requestedSide : value }); }).catch(() => { if (valid) setError("Game preferences could not load. Verify access again."); });
    return () => { valid = false; };
  }, [allowed, uid, requestedSide, account?.features.canSwitchBasketballSide]);
  const viewer = useRef({ scope, allowed });
  useLayoutEffect(() => { viewer.current = { scope, allowed }; }, [scope, allowed]);
  const [snapshot, setSnapshot] = useState<{ scope: string; data: Games; checkedAtMs: number } | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [presenceCounts,setPresenceCounts]=useState<Record<string,number>>({});
  const [countryFocus,setCountryFocus]=useState("");
  const [leagueFocus,setLeagueFocus]=useState("");
  const [allGroups,setAllGroups]=useState(false);
  const [expandedGroups,setExpandedGroups]=useState<string[]>([]);
  useEffect(() => {
    if (!active) return;
    const ticker = setInterval(() => setClockMs(Date.now()), 30000);
    return () => clearInterval(ticker);
  }, [active]);
  useEffect(() => {
    if (!allowed || !uid || sideChoice?.owner !== uid || !active) { setSnapshot(null); return; }
    let valid = true, inFlight = false, hasSnapshot = snapshot?.scope === scope;
    const load = async () => {
      if (inFlight) return; inFlight = true; setLoading(!hasSnapshot); setError("");
      try {
        const { data, error: authError } = await supabase.auth.getSession();
        if (authError || data.session?.user.id !== uid) throw new Error("Missing session");
        const games = await readLiveGames(supabase, side, account.features.canUseLiveGameHub ? null : { origin, token: data.session.access_token });
        if (valid && viewer.current.scope === scope && viewer.current.allowed) {
          setSnapshot({ scope, data: games, checkedAtMs: Date.now() });
          hasSnapshot = true;
          setClockMs(Date.now());
        }
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
      } catch { if (valid && viewer.current.scope === scope) {
        setSnapshot(current => current?.scope === scope ? current : null);
        setError("Unable to refresh game data. Previously checked scores may be outdated.");
      } }
      finally { inFlight = false; if (valid) setLoading(false); }
    };
    void load(); const timer = setInterval(() => void load(), 20000);
    return () => { valid = false; clearInterval(timer); };
  }, [allowed, uid, active, side, sideChoice?.owner, scope, revision, account?.features.canUseLiveGameHub]);
  const data = allowed && snapshot?.scope === scope ? snapshot.data : null;
  const game = typeof gameId === "string" ? data?.games.find(item => item.id === gameId) : undefined;
  const checkedAtMs = data && snapshot?.scope === scope ? snapshot.checkedAtMs : null;
  const activeLiveCount = data?.games.filter(item => gameDisplayState(item, clockMs, checkedAtMs).isLive).length ?? 0;
  const textStyle = { color: theme.foreground };
  if (accountLoading) return <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center" }}><HoopCheckLoading label="Checking Game Center access…" /></View>;
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
    const live=(rows:Games["games"])=>rows.filter(g=>gameDisplayState(g, clockMs, checkedAtMs).isLive).length;
    return count(gb)-count(ga)||live(gb)-live(ga)||gb.length-ga.length||a.localeCompare(b);
  });
  const sections = (allGroups?rankedGroups:rankedGroups.slice(0,4)).map(([title,rows])=>({
    title, total:rows.length,
    chatting:rows.reduce((n,g)=>n+(presenceCounts[g.id]||0),0),
    data:expandedGroups.includes(title)?rows:rows.slice(0,3)
  }));
  const chatEnabled = active && account.features.canUseLiveGameChat && !offline;
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100} style={{ flex: 1, backgroundColor: theme.background }}>
    <View style={{ padding: 12, gap: 8 }}>
      {!game ? <><Text accessibilityRole="header" style={{ color: theme.foreground, fontFamily: "HoopCheckDisplay", fontSize: 22 }}>GAME CENTER</Text>
      {account.features.canSwitchBasketballSide ? <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 7, padding: 4, borderRadius: 15, borderColor: theme.glassBorder, borderWidth: 1, backgroundColor: theme.elevatedSurface }}>{(["mens", "womens"] as const).map(value => <Pressable key={value} accessibilityRole="tab" aria-selected={side === value} accessibilityState={{ selected: side === value }} disabled={savingSide || sideChoice?.owner !== uid} onPress={() => void chooseSide(value)} style={{ flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 11, backgroundColor: side === value ? theme.accentSurface : "transparent", borderWidth: side === value ? 1 : 0, borderColor: theme.accent }}><Text style={{ color: side === value ? theme.accent : theme.foreground, fontWeight: "800" }}>{value === "mens" ? "Men" : "Women"}</Text></Pressable>)}</View> : <Text style={{ color: theme.muted }}>{side === "mens" ? "Men’s basketball" : "Women’s basketball"}</Text>}</> : null}
      {data ? <Text testID="game-data-checked" style={{ color: theme.muted, fontSize: 12 }}>
        {lastCheckedLabel(checkedAtMs!, clockMs)} · {activeLiveCount ? `${activeLiveCount} reported live` : "No games currently reported live"} · Provider scores may lag
      </Text> : null}
      {error ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: theme.muted }}>{error}</Text><Button secondary onPress={() => setRevision(value => value + 1)}>Retry game refresh</Button></View> : null}
      {gameId ? <Button secondary onPress={() => router.replace({pathname:"/fan-live",params:{side}})}>All games</Button> : null}
    </View>
    {game ? <View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
      <GlassSurface style={{ padding: 8, borderRadius: 12, borderWidth: 0 }}><Scoreboard game={game} teams={data?.teams || {}} checkedAtMs={checkedAtMs ?? undefined} nowMs={clockMs} featured active={active} /></GlassSurface>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 20 }}>{(["chat", "predictions"] as const).map(value => <Pressable key={value} accessibilityRole="tab" aria-selected={panel === value} accessibilityState={{ selected: panel === value }} onPress={() => setPanel(value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: panel === value ? theme.accent : theme.foreground, fontWeight: "800" }}>{value === "chat" ? "Chat" : "Predictions"}</Text></Pressable>)}</View>
      {panel === "chat" ? <GameChat key={`${uid}:${game.id}`} gameId={game.id} userId={uid!} enabled={chatEnabled} /> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}><GamePrediction key={`${uid}:${game.id}`} game={game} userId={uid!} homeName={data?.teams[game.team_id]?.name || "Home team"} awayName={data?.teams[game.opponent_team_id || ""]?.name || game.opponent_name} active={active} /></ScrollView>}
    </View> : <SectionList sections={sections} stickySectionHeadersEnabled={false} renderSectionHeader={({ section }) => <Text accessibilityRole="header" style={{ ...theme.type.section, color: theme.foreground, paddingVertical: theme.spacing.sm }}>{section.title} · {section.chatting} chatting</Text>}
    renderSectionFooter={({section})=>section.total>3?<Pressable accessibilityRole="button" onPress={()=>setExpandedGroups(current=>current.includes(section.title)?current.filter(item=>item!==section.title):[...current,section.title])}
      style={{minHeight:44,justifyContent:"center",alignItems:"center",borderWidth:1,borderColor:theme.border,borderRadius:14,marginTop:8,backgroundColor:theme.surface}}>
      <Text style={{color:theme.accent,fontWeight:"800"}}>{expandedGroups.includes(section.title)?"Show 3 games":`Show all ${section.total} games`}</Text>
    </Pressable>:null} keyExtractor={item => item.id} contentContainerStyle={{ padding: 12, gap: 4 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRevision(value => value + 1)} />} renderItem={({ item }) => <Pressable accessibilityRole="button" style={({ pressed }) => ({ minHeight: 44, opacity: pressed ? .72 : 1, backgroundColor: "transparent", borderBottomWidth: 1, borderColor: theme.border, padding: 8 })} onPress={() => router.push({ pathname: "/fan-live", params: { gameId: item.id, side } })}>
      <Scoreboard game={item} teams={data?.teams || {}} checkedAtMs={checkedAtMs ?? undefined} nowMs={clockMs} />
    </Pressable>} ListHeaderComponent={<View style={{gap:10,marginBottom:12}}>
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
      {gameId&&!loading&&data?<Text style={{color:theme.muted}}>Requested game unavailable in this basketball side. Choose a game or switch sides.</Text>:null}
    </View>} ListEmptyComponent={loading ? <HoopCheckLoading label="Checking current fixtures…" /> : <View style={{ gap: 12 }}><Text style={textStyle}>{error || "No current games are available in this basketball side. The provider may not have published new fixtures yet."}</Text><Button secondary onPress={() => setRevision(value => value + 1)}>Refresh games</Button></View>} />}
  </KeyboardAvoidingView>;
}
