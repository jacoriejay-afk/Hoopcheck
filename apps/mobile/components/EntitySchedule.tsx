import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { fixtureCalendarFile } from "../src/native/fixtureCalendar";
import { useRouter } from "expo-router";
import { DirectoryCrest } from "./DirectoryIdentity";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useNetwork } from "../src/native/network";
import { useActiveScreen } from "../src/native/useActiveScreen";
import { readWithDeadline } from "../src/native/readDeadline";
import { readLiveGames } from "../src/native/liveGames";
import { upcomingEntityGames, type ScheduleScope } from "../src/native/entitySchedule";
import { supabase } from "../src/lib/supabase";

// Default off until fixture export rights and device import are separately accepted.
const calendarExportEnabled = process.env.EXPO_PUBLIC_HOOPCHECK_FIXTURE_EXPORT_ENABLED === "true";
// Called only from a user-confirmed async export, never from render.
function temporaryCalendarUri(cache: string) {
  return cache + "hoopcheck-fixture-" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".ics";
}
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
type Result = Awaited<ReturnType<typeof readLiveGames>>;
export function EntitySchedule({ scope, side, refresh = 0 }: {
  scope: ScheduleScope; side: "mens" | "womens"; refresh?: number;
}) {
  const theme = useEntryTheme(), router = useRouter(), { account, loading } = useNativeAccount();
  const { offline, revision } = useNetwork();
  const active = useActiveScreen();
  const uid = account?.user.id;
  const hub = Boolean(account?.features.canUseLiveGameHub);
  const allowed = Boolean(uid && !offline && (hub || account?.user.accountType === "player")
    && (side === "mens" || account?.features.canSwitchBasketballSide));
  const teamId = scope.kind === "team" ? scope.id : null;
  const leagueName = scope.kind === "league" ? scope.name : null;
  const country = scope.kind === "league" ? scope.country : null;
  const scopeId = JSON.stringify([teamId, leagueName, country]);
  const key = [uid, side, scope.kind, scopeId, hub].join(":");
  const [state, setState] = useState<{ key: string; data: Result | null; failed: boolean } | null>(null);
  const [attempt, retry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const exportBusy = useRef(false);
  const activeKey = useRef<string | null>(null);
  useEffect(() => {activeKey.current = allowed && active ? key : null; return () => {activeKey.current = null;};}, [allowed, active, key]);
  const [exportMessage,setExportMessage] = useState("");
  useEffect(() => setExportMessage(""),[key]);
  async function exportCalendar(input: Parameters<typeof fixtureCalendarFile>[0]) {
    if (!calendarExportEnabled || exportBusy.current || activeKey.current !== key || !uid) return;
    exportBusy.current = true;
    let uri: string | undefined;
    try {
      const verify = async () => {const result = await readWithDeadline(() => supabase.auth.getSession());if (result.error || result.data.session?.user.id !== uid || activeKey.current !== key) throw Error("Session changed");};
      const calendar = fixtureCalendarFile(input);
      if (!calendar || !FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw Error("Export unavailable");
      await verify();
      uri = temporaryCalendarUri(FileSystem.cacheDirectory);
      await FileSystem.writeAsStringAsync(uri, calendar);
      await verify();
      await Sharing.shareAsync(uri,{mimeType:"text/calendar",UTI:"com.apple.ical.ics",dialogTitle:"Export scheduled game"});
    } catch { if (activeKey.current === key) setExportMessage("Calendar export unavailable. Recheck the game and try again."); }
    finally { if (uri) {try {await FileSystem.deleteAsync(uri,{idempotent:true});} catch {if(activeKey.current===key)setExportMessage("Temporary calendar file could not be removed.");}} exportBusy.current=false; }
  }
  useEffect(() => {
    if (!allowed || !uid || !active) { setState(null); return; }
    let alive = true;
    setState(null);
    const load = async () => {
      try {
        const session = await readWithDeadline(() => supabase.auth.getSession());
        if (session.error || session.data.session?.user.id !== uid) throw new Error("Session changed");
        const selection: ScheduleScope = teamId ? { kind: "team", id: teamId } : { kind: "league", name: leagueName || "", country };
        const data = await readLiveGames(supabase, side, hub ? null : { origin, token: session.data.session.access_token }, new Date(), fetch, selection);
        if (alive) setState({ key, data, failed: false });
      } catch { if (alive) setState({ key, data: null, failed: true }); }
    };
    void load();
    return () => { alive = false; };
  }, [allowed, uid, active, side, hub, key, teamId, leagueName, country, revision, refresh, attempt]);
  const current = allowed && state?.key === key ? state : null;
  const games = current?.data ? upcomingEntityGames(current.data.games, scope) : [];
  const muted = { color: theme.muted, fontSize: 12, lineHeight: 18 };
  return <View testID="entity-upcoming-games" style={{ marginTop: 10, gap: 5 }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontFamily: "HoopCheckDisplay", fontSize: 22 }}>UPCOMING GAMES</Text>
    {loading || (allowed && !current) ? <Text accessibilityRole="progressbar" style={muted}>Checking schedule…</Text> :
      !allowed ? <Text style={muted}>{offline ? "Reconnect to check the schedule." : "Open Game Center to verify schedule access for your membership and basketball side."}</Text> :
      current?.failed ? <><Text accessibilityRole="alert" style={muted}>Schedule could not load.</Text><Pressable accessibilityRole="button" onPress={() => retry(v => v + 1)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.accent }}>Retry schedule</Text></Pressable></> :
      !games.length ? <Text style={muted}>No confirmed upcoming fixtures available in Game Center.</Text> :
      games.slice(0, expanded ? 30 : 3).map(game => {
        const home = current?.data?.teams[game.team_id];
        const away = current?.data?.teams[game.opponent_team_id || ""];
        const calendarInput = {id:game.id,status:game.status,scheduledAt:game.scheduled_at,home:home?.name || "",away:away?.name || game.opponent_name,side};
        return <View key={game.id} style={{gap:4}}><Pressable accessibilityRole="button" accessibilityLabel={(home?.name || "Home team") + " versus " + (away?.name || game.opponent_name) + ", open game"}
          onPress={() => router.push({ pathname: "/fan-live", params: { gameId: game.id, side } })}
          style={{ minHeight: 62, borderBottomWidth: 1, borderColor: theme.border, paddingVertical: 5, gap: 4 }}>
          <Text style={muted}>{new Date(game.scheduled_at!).toLocaleString([], { month: "short", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" })}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <DirectoryCrest name={home?.name || "Home team"} logoUrl={home?.logo_url} size={24} />
            <Text numberOfLines={2} style={{ color: theme.foreground, flex: 1, fontSize: 13 }}>{home?.name || "Home team"}</Text>
            <Text style={{ color: theme.accent, fontFamily: "HoopCheckDisplay", fontSize: 16 }}>VS</Text>
            <DirectoryCrest name={away?.name || game.opponent_name} logoUrl={away?.logo_url} size={24} />
            <Text numberOfLines={2} style={{ color: theme.foreground, flex: 1, fontSize: 13 }}>{away?.name || game.opponent_name}</Text>
          </View>
        </Pressable>
        {calendarExportEnabled && (Platform.OS === "ios" || Platform.OS === "android") && calendarInput.home && calendarInput.away && calendarInput.scheduledAt ? <Pressable accessibilityRole="button" accessibilityLabel="Export game to calendar" onPress={() => Alert.alert("Export game to calendar", "This shares a calendar file with the scheduled tip-off only. Your calendar will not automatically update if the schedule changes.",[{text:"Cancel",style:"cancel"},{text:"Export",onPress:()=>void exportCalendar(calendarInput)}])} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:theme.accent}}>Export to calendar</Text></Pressable> : null}</View>;
      })}
    {exportMessage ? <Text accessibilityRole="alert" style={muted}>{exportMessage}</Text> : null}
    {games.length > 3 ? <Pressable accessibilityRole="button" onPress={() => setExpanded(v => !v)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.accent }}>{expanded ? "Show fewer fixtures" : "Show more fixtures"}</Text></Pressable> : null}
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/fan-live", params: { side } })}
      style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.accent, fontWeight: "700" }}>Open Game Center</Text></Pressable>
  </View>;
}
