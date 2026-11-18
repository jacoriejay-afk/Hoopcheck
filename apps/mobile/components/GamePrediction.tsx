import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useEntryTheme } from "../src/theme";
import { requireOnline } from "../src/native/network";
import { pickGameWinner, readPrediction, type LiveGame, type Prediction } from "../src/native/liveGames";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";

export function GamePrediction({ game, userId, homeName, awayName, active }: { game: LiveGame; userId: string; homeName: string; awayName: string; active: boolean }) {
  const theme = useEntryTheme();
  const scope = `${userId}:${game.id}`;
  const [snapshot, setSnapshot] = useState<{ scope: string; data: Prediction } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let valid = true;
    const refresh = async () => {
      setNow(Date.now());
      try {
        await requireOnline();
        const { data, error } = await supabase.auth.getSession();
        if (error || data.session?.user.id !== userId) throw new Error("Missing session");
        const prediction = await readPrediction(origin, data.session.access_token, game.id);
        if (valid) setSnapshot({ scope, data: prediction });
      } catch { if (valid) { setSnapshot(null); setMessage("Predictions could not load. Reconnecting…"); } }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 15000);
    return () => { valid = false; clearInterval(timer); };
  }, [active, game.id, userId, scope, revision]);
  const data = active && snapshot?.scope === scope ? snapshot.data : null;
  const tip = Date.parse(game.scheduled_at || "");
  const locked = !data || data.locked || !Number.isFinite(tip) || now >= tip;
  async function pick(teamId: string) {
    if (locked || pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      await requireOnline();
      const { data, error } = await supabase.auth.getSession();
      if (error || data.session?.user.id !== userId) throw new Error("Sign in again before making a prediction.");
      await pickGameWinner(origin, data.session.access_token, game.id, teamId);
      setMessage("Pick saved. You can change it until tip-off."); setRevision(value => value + 1);
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Pick could not be confirmed."); setSnapshot(null); setRevision(value => value + 1); }
    finally { pending.current = false; setBusy(false); }
  }
  return <View style={{ gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 21, fontWeight: "800" }}>Pick the winner</Text>
    <Text style={{ color: theme.muted }}>{!data ? "Verifying predictions…" : locked ? "Picks locked at tip-off." : "One pick per game. Change it until tip-off."}</Text>
    {[{ id: game.team_id, name: homeName }, { id: game.opponent_team_id, name: awayName }].filter((team): team is { id: string; name: string } => Boolean(team.id)).map(team => <Pressable key={team.id} accessibilityRole="button" aria-pressed={data?.my_pick === team.id} accessibilityState={{ selected: data?.my_pick === team.id, disabled: locked || busy }} disabled={locked || busy} onPress={() => void pick(team.id)} style={{ minHeight: 48, padding: 12, borderRadius: theme.radius.control, backgroundColor: data?.my_pick === team.id ? theme.accentSurface : theme.chip }}><Text style={{ color: theme.foreground }}>{team.name}{data?.my_pick === team.id ? " ✓ Your pick" : ""}</Text></Pressable>)}
    {data?.results ? <Text style={{ color: theme.foreground }}>{data.results.winner_percent}% picked the winner · {data.results.correct_picks} correct of {data.results.total_picks}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: theme.muted }}>{message}</Text> : null}
  </View>;
}
