import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { motion } from "../src/motion/config";
import { EntityArtwork } from "./EntityArtwork";
import { useEntryTheme } from "../src/theme";
import type { LiveGame, GameTeam } from "../src/native/liveGames";

/**
 * Short, one-shot pulse only when a previously rendered LIVE score changes.
 * Initial loads, final/scheduled games, missing scores and Reduce Motion stay still.
 * No guessed score, animation timer, subscription or data-status change.
 */
function ScoreValue({ name, score, live, color, fontSize, fontFamily }: {
  name: string; score: number | null; live: boolean; color: string; fontSize: number; fontFamily?: string;
}) {
  const reduced = useMotionSetting();
  const previous = useRef<number | null | undefined>(undefined);
  const scale = useSharedValue(1);
  useEffect(() => {
    const last = previous.current;
    previous.current = score;
    cancelAnimation(scale);
    if (reduced || !live || last == null || score == null || last === score) {
      scale.set(1);
      return;
    }
    scale.set(withSequence(
      withTiming(1.12, { duration: 140 }),
      withSpring(1, motion.spring),
    ));
    return () => cancelAnimation(scale);
  }, [score, live, reduced, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.Text selectable accessibilityLabel={`${name}: ${score == null ? "score not reported" : score}`}
    style={[{ color, fontSize, fontFamily, fontWeight: "700", letterSpacing: -.6, fontVariant: ["tabular-nums"] }, animated]}>
    {score ?? "—"}
  </Animated.Text>;
}

/** Same score hierarchy in Home, league groups and game detail. Null is never zero. */
export function Scoreboard({ game, teams }: { game: LiveGame; teams: Record<string, GameTeam> }) {
  const t = useEntryTheme();
  const live = game.status === "live";
  const home = teams[game.team_id]?.name || "Home team";
  const away = teams[game.opponent_team_id || ""]?.name || game.opponent_name || "Opponent";
  return <View style={{ gap: t.spacing.sm, borderLeftWidth: live ? 3 : 0, borderLeftColor: t.button, paddingLeft: live ? t.spacing.md : 0 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm, alignItems: "center" }}>
      <View style={{ backgroundColor: live ? t.accentSurface : t.chip, paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xs, borderRadius: t.radius.pill }}><Text style={{ color: live ? t.accent : t.onChip, ...t.type.caption, fontWeight: "700" }}>{live ? "● LIVE" : game.status.toUpperCase()}{game.period_label ? ` · ${game.period_label}` : ""}</Text></View>
      <Text style={{ color: t.muted, ...t.type.caption }}>{game.scheduled_at && Number.isFinite(Date.parse(game.scheduled_at)) ? new Date(game.scheduled_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Tip-off not confirmed"}</Text>
    </View>
    {([{ name: home, score: game.home_score }, { name: away, score: game.away_score }]).map((team, index) => <View key={index} style={{ flexDirection: "row", gap: t.spacing.md, alignItems: "center" }}>
      <EntityArtwork name={team.name} kind="teams" size={36} />
      <Text style={{ flex: 1, minWidth: 0, color: t.foreground, ...t.type.section }}>{team.name}</Text>
      <ScoreValue name={team.name} score={team.score} live={live} color={t.foreground} fontSize={t.courtside.typography.score} fontFamily={t.type.ui.fontFamily} />
    </View>)}
    {game.home_score == null || game.away_score == null ? <Text style={{ color: t.muted, ...t.type.caption }}>Score not reported</Text> : null}
  </View>;
}
