import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Animated, { cancelAnimation, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { motion } from "../src/motion/config";
import { EntityArtwork } from "./EntityArtwork";
import { GlassBadge, isFreshLive } from "./glass/GlassBadge";
import { glassTokens as glass } from "../src/glassTheme";
import { useEntryTheme } from "../src/theme";
import type { LiveGame, GameTeam } from "../src/native/liveGames";

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
export function Scoreboard({ game, teams, animateLive = false }: {
  game: LiveGame; teams: Record<string, GameTeam>; animateLive?: boolean;
}) {
  const t = useEntryTheme();
  const reduced = useMotionSetting();
  // GLASS-1 isFreshLive is the single source of truth. Unknown timestamps never pulse.
  const live = isFreshLive(game.status, (game as LiveGame & { score_updated_at?: string | null }).score_updated_at);
  const borderPhase = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(borderPhase);
    if (live && animateLive && !reduced) {
      borderPhase.set(withRepeat(withSequence(
        withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 }),
      ), -1, false));
    } else borderPhase.set(0);
    return () => cancelAnimation(borderPhase);
  }, [live, animateLive, reduced, borderPhase]);
  const borderPulse = useAnimatedStyle(() => ({
    borderLeftColor: interpolateColor(borderPhase.get(), [0, 1],
      [glass.orange, "rgba(255,112,46,0.34)"]),
  }));
  const home = teams[game.team_id]?.name || "Home team";
  const away = teams[game.opponent_team_id || ""]?.name || game.opponent_name || "Opponent";
  return <Animated.View style={[{ gap: t.spacing.sm, borderLeftWidth: live ? 3 : 0, paddingLeft: live ? t.spacing.md : 0 }, borderPulse]}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm, alignItems: "center" }}>
      <GlassBadge live={live} label={live ? "● LIVE" : game.status === "scheduled" ? "SCHEDULED" : ["live", "final", "finished"].includes(game.status) ? "FINAL" : game.status.toUpperCase()} />
      <Text style={{ color: t.muted, ...t.type.caption }}>{game.scheduled_at && Number.isFinite(Date.parse(game.scheduled_at)) ? new Date(game.scheduled_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Tip-off not confirmed"}</Text>
    </View>
    {([{ name: home, score: game.home_score }, { name: away, score: game.away_score }]).map((team, index) => <View key={index} style={{ flexDirection: "row", gap: t.spacing.md, alignItems: "center" }}>
      <EntityArtwork name={team.name} kind="teams" size={36} />
      <Text style={{ flex: 1, minWidth: 0, color: t.foreground, ...t.type.section }}>{team.name}</Text>
      <ScoreValue gameId={game.id} name={team.name} score={team.score} live={live} color={game.home_score != null && game.away_score != null && team.score! > (index === 0 ? game.away_score : game.home_score) ? glass.orange : t.foreground} fontSize={t.courtside.typography.score} fontFamily={t.type.ui.fontFamily} />
    </View>)}
    {game.home_score == null || game.away_score == null ? <Text style={{ color: t.muted, ...t.type.caption }}>Score not reported</Text> : null}
  </Animated.View>;
}
