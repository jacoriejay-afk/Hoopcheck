import { Text, View } from "react-native";
import { EntityArtwork } from "./EntityArtwork";
import { useEntryTheme } from "../src/theme";
import type { LiveGame, GameTeam } from "../src/native/liveGames";

/** Same score hierarchy in Home, league groups and game detail. Null is never zero. */
export function Scoreboard({ game, teams }: { game: LiveGame; teams: Record<string, GameTeam> }) {
  const t = useEntryTheme();
  const live = game.status === "live";
  const home = teams[game.team_id]?.name || "Home team";
  const away = teams[game.opponent_team_id || ""]?.name || game.opponent_name || "Opponent";
  return <View style={{ gap: t.spacing.md }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm, alignItems: "center" }}>
      <View style={{ backgroundColor: live ? t.accentSurface : t.chip, paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xs, borderRadius: t.radius.pill }}><Text style={{ color: live ? t.accent : t.onChip, ...t.type.caption, fontWeight: "700" }}>{live ? "● LIVE" : game.status.toUpperCase()}{game.period_label ? ` · ${game.period_label}` : ""}</Text></View>
      <Text style={{ color: t.muted, ...t.type.caption }}>{game.scheduled_at && Number.isFinite(Date.parse(game.scheduled_at)) ? new Date(game.scheduled_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Tip-off not confirmed"}</Text>
    </View>
    {([{ name: home, score: game.home_score }, { name: away, score: game.away_score }]).map((team, index) => <View key={index} style={{ flexDirection: "row", gap: t.spacing.md, alignItems: "center" }}>
      <EntityArtwork name={team.name} kind="teams" size={32} />
      <Text style={{ flex: 1, minWidth: 0, color: t.foreground, ...t.type.section }}>{team.name}</Text>
      <Text selectable accessibilityLabel={`${team.name}: ${team.score == null ? "score not reported" : team.score}`} style={{ color: t.foreground, fontSize: 26, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{team.score ?? "—"}</Text>
    </View>)}
    {game.home_score == null || game.away_score == null ? <Text style={{ color: t.muted, ...t.type.caption }}>Score not reported</Text> : null}
  </View>;
}
