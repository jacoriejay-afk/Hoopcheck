import type { LiveGame } from "./liveGames";
import { gameDisplayState } from "./gameFreshness";

/** Home only highlights games happening now or about to happen.
 * Completed games belong in Game Center, not under a "Live" home rail.
 * Reject stale live statuses rather than repeating week-old results as live.
 */
export function selectHomePreviewGames(
  games: readonly LiveGame[], nowMs: number = Date.now(), maxResults = 2,
): LiveGame[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const kickoff = (game: LiveGame) => Date.parse(game.scheduled_at || game.started_at || "");
  return games.filter(game => {
    const time = kickoff(game);
    if (!Number.isFinite(time)) return false;
    const state = gameDisplayState(game, nowMs);
    if (state.kind === "live") return time >= nowMs - dayMs && time <= nowMs + 6 * 60 * 60 * 1000;
    if (state.kind === "upcoming") return time >= nowMs;
    return false;
  }).sort((a, b) => {
    const aLive = gameDisplayState(a, nowMs).isLive;
    const bLive = gameDisplayState(b, nowMs).isLive;
    if (aLive !== bLive) return aLive ? -1 : 1;
    return kickoff(a) - kickoff(b) || a.id.localeCompare(b.id);
  }).slice(0, Math.max(0, Math.min(Math.trunc(maxResults) || 0, 4)));
}
