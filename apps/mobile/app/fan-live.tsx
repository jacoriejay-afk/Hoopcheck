import { Scoreboard } from "../components/Scoreboard";
import { Skeleton } from "../components/Motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SectionList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button, PressableCard } from "../src/primitives";
import { GameChat } from "../components/GameChat";
import { GamePrediction } from "../components/GamePrediction";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { requireOnline, useNetwork } from "../src/native/network";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { readBasketballSide, readLiveGames, saveBasketballSide } from "../src/native/liveGames";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
type Games = Awaited<ReturnType<typeof readLiveGames>>;
export default function LiveGames() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId?: string }>();
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
      } catch { if (valid) { setSnapshot(null); setError("Live games could not load. Try again."); } }
      finally { inFlight = false; if (valid) setLoading(false); }
    };
    void load(); const timer = setInterval(() => void load(), 20000);
    return () => { valid = false; clearInterval(timer); };
  }, [allowed, uid, active, side, sideChoice?.owner, scope, revision, account?.features.canUseLiveGameHub]);
  const data = allowed && snapshot?.scope === scope ? snapshot.data : null;
  const game = typeof gameId === "string" ? data?.games.find(item => item.id === gameId) : undefined;
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
      if (viewer.current.scope === scope) setSideChoice({ owner: uid, side: value });
    } catch { if (viewer.current.scope === scope) setError("Basketball preference could not be saved. Try again."); }
    finally { setSavingSide(false); }
  }
  const leagueGroups = new Map<string, Games["games"]>();
  for (const item of data?.games ?? []) {
    const key = [item.league_name || "Around the court", item.country].filter(Boolean).join(" · ");
    const rows = leagueGroups.get(key) || []; rows.push(item); leagueGroups.set(key, rows);
  }
  const sections = [...leagueGroups].map(([title, rows]) => ({ title, data: rows }));
  const chatEnabled = active && account.features.canUseLiveGameChat && !offline;
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100} style={{ flex: 1, backgroundColor: theme.background }}>
    <View style={{ padding: 16, gap: 10 }}>
      {!game ? <><Text style={{ ...theme.type.body, color: theme.muted }}>Scores, conversations and predictions.</Text>
      {account.features.canSwitchBasketballSide ? <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 16 }}>{(["mens", "womens"] as const).map(value => <Pressable key={value} accessibilityRole="tab" aria-selected={side === value} accessibilityState={{ selected: side === value }} disabled={savingSide || sideChoice?.owner !== uid} onPress={() => void chooseSide(value)} style={{ minHeight: 44, justifyContent: "center", borderBottomWidth: side === value ? 3 : 0, borderColor: theme.accent }}><Text style={{ color: theme.foreground, fontWeight: "800" }}>{value === "mens" ? "Men" : "Women"}</Text></Pressable>)}</View> : <Text style={{ color: theme.muted }}>{side === "mens" ? "Men’s basketball" : "Women’s basketball"}</Text>}</> : null}
      {error ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: theme.muted }}>{error}</Text><Button secondary onPress={retry}>Verify access again</Button></View> : null}
      {gameId ? <Button secondary onPress={() => router.replace("/fan-live")}>All games</Button> : null}
    </View>
    {game ? <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
      <View style={{ padding: theme.spacing.lg, backgroundColor: theme.surface, borderRadius: theme.radius.card }}><Scoreboard game={game} teams={data?.teams || {}} /></View>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 20 }}>{(["chat", "predictions"] as const).map(value => <Pressable key={value} accessibilityRole="tab" aria-selected={panel === value} accessibilityState={{ selected: panel === value }} onPress={() => setPanel(value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: panel === value ? theme.accent : theme.foreground, fontWeight: "800" }}>{value === "chat" ? "Chat" : "Predictions"}</Text></Pressable>)}</View>
      {panel === "chat" ? <GameChat key={`${uid}:${game.id}`} gameId={game.id} userId={uid!} enabled={chatEnabled} /> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}><GamePrediction key={`${uid}:${game.id}`} game={game} userId={uid!} homeName={data?.teams[game.team_id]?.name || "Home team"} awayName={data?.teams[game.opponent_team_id || ""]?.name || game.opponent_name} active={active} /></ScrollView>}
    </View> : <SectionList sections={sections} stickySectionHeadersEnabled={false} renderSectionHeader={({ section }) => <Text accessibilityRole="header" style={{ ...theme.type.section, color: theme.foreground, paddingVertical: theme.spacing.md }}>{section.title}</Text>} keyExtractor={item => item.id} contentContainerStyle={{ padding: 16, gap: 12 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRevision(value => value + 1)} />} renderItem={({ item }) => <PressableCard accessibilityRole="button" onPress={() => router.push({ pathname: "/fan-live", params: { gameId: item.id } })}>
      <Scoreboard game={item} teams={data?.teams || {}} />
    </PressableCard>} ListHeaderComponent={gameId && !loading ? <Text style={{ color: theme.muted, paddingBottom: 12 }}>The requested game is unavailable in this basketball side. Choose a game or switch sides.</Text> : null} ListEmptyComponent={loading ? <Skeleton /> : <View style={{ gap: 12 }}><Text style={textStyle}>{error || "No current games are available."}</Text><Button secondary onPress={() => setRevision(value => value + 1)}>Refresh games</Button></View>} />}
  </KeyboardAvoidingView>;
}
