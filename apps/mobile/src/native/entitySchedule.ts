import type { LiveGame } from "./liveGames";

export type ScheduleScope = { kind: "team"; id: string } |
  { kind: "league"; name: string; country: string | null };
const normalize = (value: string | null) => (value ?? "").normalize("NFKC").trim().toLowerCase();
export function upcomingEntityGames(games: LiveGame[], scope: ScheduleScope, now = Date.now()) {
  const ids = new Set<string>();
  return games.filter(game => {
    const date = Date.parse(game.scheduled_at || "");
    if (game.status !== "scheduled" || !Number.isFinite(date) || date < now || ids.has(game.id)) return false;
    const match = scope.kind === "team"
      ? game.team_id === scope.id || game.opponent_team_id === scope.id
      : Boolean(normalize(scope.name) && normalize(scope.country)
        && normalize(game.league_name) === normalize(scope.name) && normalize(game.country) === normalize(scope.country));
    if (match) ids.add(game.id);
    return match;
  }).sort((a,b) => Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!) || a.id.localeCompare(b.id));
}
