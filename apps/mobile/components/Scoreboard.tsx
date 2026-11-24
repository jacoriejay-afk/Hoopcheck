import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { motion } from "../src/motion/config";
import { EntityArtwork } from "./EntityArtwork";
import { useEntryTheme } from "../src/theme";
import type { LiveGame, GameTeam } from "../src/native/liveGames";
import { gameDisplayState, providerReceiptLabel } from "../src/native/gameFreshness";

/**
 * Short, one-shot pulse only when a previously rendered LIVE score changes.
 * Initial loads, final/scheduled games, missing scores and Reduce Motion stay still.
 * No guessed score, animation timer, subscription or data-status change.
 */
function ScoreValue({ gameId, name, score, live, color, fontSize, fontFamily }: {
  gameId: string; name: string; score: number | null; live: boolean; color: string; fontSize: number; fontFamily?: string;
}) {
  const reduced = useMotionSetting();
  const previous = useRef<{ gameId: string; score: number | null; live: boolean } | null>(null);
  const scale = useSharedValue(1);
  useEffect(() => {
    const last = previous.current;
    previous.current = { gameId, score, live };
    cancelAnimation(scale);
    if (reduced || !live || !last?.live || last.gameId !== gameId || last.score == null || score == null || last.score === score) {
      scale.set(1);
      return;
    }
    scale.set(withSequence(
      withTiming(1.12, { duration: 140 }),
      withSpring(1, motion.spring),
    ));
    return () => cancelAnimation(scale);
  }, [gameId, score, live, reduced, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.Text selectable accessibilityLabel={`${name}: ${score == null ? "score not reported" : score}`}
    style={[{ color, fontSize, fontFamily, fontWeight: "700", letterSpacing: -.6, fontVariant: ["tabular-nums"] }, animated]}>
    {score ?? "—"}
  </Animated.Text>;
}

/** Same score hierarchy in Home, league groups and game detail. Null is never zero. */
export function Scoreboard({ game, teams, checkedAtMs, nowMs }: { game: LiveGame; teams: Record<string, GameTeam>; checkedAtMs?: number; nowMs?: number }) {
  const t = useEntryTheme();
  const state = gameDisplayState(game, nowMs, checkedAtMs);
  const live = state.isLive;
  const host = teams[game.team_id];
  const visitor = teams[game.opponent_team_id || ""];
  const home = host?.name || "Home team";
  const away = visitor?.name || game.opponent_name || "Opponent";
  return <View style={{ gap: 4, borderLeftWidth: live ? 2 : 0, borderLeftColor: t.button, paddingLeft: live ? 8 : 0 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm, alignItems: "center" }}>
      <View style={{ backgroundColor: live ? t.accentSurface : t.chip, paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xs, borderRadius: t.radius.pill }}><Text style={{ color: live ? t.accent : t.onChip, ...t.type.caption, fontWeight: "700" }}>{state.label}{live && game.period_label ? ` · ${game.period_label}` : ""}</Text></View>
      <Text style={{ color: t.muted, ...t.type.caption }}>{game.scheduled_at && Number.isFinite(Date.parse(game.scheduled_at)) ? new Date(game.scheduled_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Tip-off not confirmed"}</Text>
    </View>
    {([{ name: home, score: game.home_score, logo: host?.logo_url, bg: host?.logo_bg }, { name: away, score: game.away_score, logo: visitor?.logo_url, bg: visitor?.logo_bg }]).map((team, index) => <View key={index} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <EntityArtwork name={team.name} kind="teams" size={28} logoUrl={team.logo} logoBg={team.bg} />
      <Text style={{ flex: 1, minWidth: 0, color: t.foreground, ...t.type.section }}>{team.name}</Text>
      <ScoreValue gameId={game.id} name={team.name} score={team.score} live={live} color={t.foreground} fontSize={Math.min(24, t.courtside.typography.score)} fontFamily={t.type.ui.fontFamily} />
    </View>)}
    {game.home_score == null || game.away_score == null ? <Text style={{ color: t.muted, ...t.type.caption }}>Score not reported</Text> : null}
    {game.status === "live" ? <Text style={{ color: t.muted, ...t.type.caption }}>{providerReceiptLabel(game.score_updated_at, nowMs)}</Text> : null}
    {state.needsVerification ? <Text style={{ color: t.muted, ...t.type.caption }}>Provider status not verified. Results may be delayed.</Text> : null}
  </View>;
}
