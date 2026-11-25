import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { motion } from "../src/motion/config";
import { EntityArtwork } from "./EntityArtwork";
import { useEntryTheme } from "../src/theme";
import type { LiveGame, GameTeam } from "../src/native/liveGames";
import { gameDisplayState, providerReceiptLabel, nativeScoreDisplay } from "../src/native/gameFreshness";

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

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** A decorative travelling orange highlight; never determines game status. */
function LiveBorder({ width, height, running }: { width: number; height: number; running: boolean }) {
  const phase = useSharedValue(0);
  const radius = 10;
  const perimeter = Math.max(1, 2 * (width + height - 4) - (8 - 2 * Math.PI) * radius);
  useEffect(() => {
    cancelAnimation(phase);
    phase.set(0);
    if (running) phase.set(withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [running, phase]);
  const travel = useAnimatedProps(() => ({ strokeDashoffset: -phase.get() * perimeter }));
  const geometry = { x: 1, y: 1, width: Math.max(0, width - 2), height: Math.max(0, height - 2), rx: radius, fill: "none" as const };
  if (width < 24 || height < 24) return null;
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Svg width={width} height={height}>
      <Rect {...geometry} stroke="#FF702E" strokeWidth={1} strokeOpacity={0.24} />
      {running ? <>
        <AnimatedRect {...geometry} stroke="#FF702E" strokeOpacity={0.32} strokeWidth={2} strokeLinecap="round" strokeDasharray={[perimeter * 0.24, perimeter * 0.76]} animatedProps={travel} />
        <AnimatedRect {...geometry} stroke="#FF702E" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round" strokeDasharray={[perimeter * 0.13, perimeter * 0.87]} animatedProps={travel} />
        <AnimatedRect {...geometry} stroke="#FFAB74" strokeWidth={2} strokeLinecap="round" strokeDasharray={[perimeter * 0.06, perimeter * 0.94]} animatedProps={travel} />
      </> : <Rect {...geometry} stroke="#FF702E" strokeWidth={1.5} strokeOpacity={0.75} />}
    </Svg>
  </View>;
}

/** Same score hierarchy in Home, league groups and game detail. Null is never zero. */
export function Scoreboard({ game, teams, checkedAtMs, nowMs, featured = false, active = false }: { game: LiveGame; teams: Record<string, GameTeam>; checkedAtMs?: number; nowMs?: number; featured?: boolean; active?: boolean }) {
  const t = useEntryTheme();
  const state = gameDisplayState(game, nowMs, checkedAtMs);
  const display = nativeScoreDisplay(game, nowMs);
  const live = state.isLive && !display.warning;
  const reduced = useMotionSetting();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const showBorder = featured && live;
  const host = teams[game.team_id];
  const visitor = teams[game.opponent_team_id || ""];
  const home = host?.name || "Home team";
  const away = visitor?.name || game.opponent_name || "Opponent";
  return <View onLayout={featured ? ({ nativeEvent: { layout } }) => setSize(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height }) : undefined} style={{ gap: 4, borderLeftWidth: live && !showBorder ? 2 : 0, borderLeftColor: t.button, paddingLeft: live && !showBorder ? 8 : 0, padding: showBorder ? 8 : undefined }}>
    {showBorder ? <LiveBorder width={size.width} height={size.height} running={active && !reduced} /> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm, alignItems: "center" }}>
      <View style={{ backgroundColor: live ? t.accentSurface : t.chip, paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xs, borderRadius: t.radius.pill }}><Text style={{ color: live ? t.accent : t.onChip, ...t.type.caption, fontWeight: "700" }}>{display.warning && state.isLive ? "Awaiting score update" : state.label}{live && display.showPeriod && game.period_label ? ` · ${game.period_label}` : ""}</Text></View>
      <Text style={{ color: t.muted, ...t.type.caption }}>{game.scheduled_at && Number.isFinite(Date.parse(game.scheduled_at)) ? new Date(game.scheduled_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Tip-off not confirmed"}</Text>
    </View>
    {([{ name: home, score: display.homeScore, logo: host?.logo_url, bg: host?.logo_bg }, { name: away, score: display.awayScore, logo: visitor?.logo_url, bg: visitor?.logo_bg }]).map((team, index) => <View key={index} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <EntityArtwork name={team.name} kind="teams" size={28} logoUrl={team.logo} logoBg={team.bg} />
      <Text style={{ flex: 1, minWidth: 0, color: t.foreground, ...t.type.section }}>{team.name}</Text>
      <ScoreValue gameId={game.id} name={team.name} score={team.score} live={live} color={t.foreground} fontSize={Math.min(24, t.courtside.typography.score)} fontFamily={t.type.ui.fontFamily} />
    </View>)}
    {display.homeScore == null || display.awayScore == null ? <Text style={{ color: t.muted, ...t.type.caption }}>Score not reported</Text> : null}
    {game.status === "live" ? <Text style={{ color: t.muted, ...t.type.caption }}>{providerReceiptLabel(game.score_updated_at, nowMs)}</Text> : null}
    {display.sourceLabel ? <Text style={{ color: t.muted, ...t.type.caption }}>{display.sourceLabel}</Text> : null}
    {display.warning ? <Text accessibilityRole="alert" style={{ color: t.muted, ...t.type.caption }}>{display.warning}</Text> : null}
    {state.needsVerification ? <Text style={{ color: t.muted, ...t.type.caption }}>Provider status not verified. Results may be delayed.</Text> : null}
  </View>;
}
