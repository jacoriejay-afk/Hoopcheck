import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
        return <Pressable key={game.id} accessibilityRole="button" accessibilityLabel={(home?.name || "Home team") + " versus " + (away?.name || game.opponent_name) + ", open game"}
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
        </Pressable>;
      })}
    {games.length > 3 ? <Pressable accessibilityRole="button" onPress={() => setExpanded(v => !v)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.accent }}>{expanded ? "Show fewer fixtures" : "Show more fixtures"}</Text></Pressable> : null}
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/fan-live", params: { side } })}
      style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: theme.accent, fontWeight: "700" }}>Open Game Center</Text></Pressable>
  </View>;
}
