/** LIVE-2: a provider status alone is never proof of a current live score. */
export type VerifiedGameStatus = "scheduled" | "live" | "final";
export type ScoreSource = "api" | "fan" | "none";
export type ScoreFreshnessInput = {
  status: string;
  score_source: ScoreSource | null;
  score_updated_at: string | null;
};
export const LIVE_SCORE_MAX_AGE_MS = 5 * 60_000;

/** True only for a positive-age, strictly under-five-minute verified update. */
export function hasFreshLiveScore(game: ScoreFreshnessInput, now = new Date()): boolean {
  if (game.status !== "live" || game.score_source === "none" || !game.score_source) return false;
  const updated = game.score_updated_at ? Date.parse(game.score_updated_at) : NaN;
  const age = now.getTime() - updated;
  return Number.isFinite(age) && age >= 0 && age < LIVE_SCORE_MAX_AGE_MS;
}

/** Stale in-play records retain their last known score without a LIVE badge. */
export function getGameScoreDisplay(game: ScoreFreshnessInput, now = new Date()):
  { label: "LIVE" | "UPCOMING" | "FINAL" | "LAST UPDATE"; live: boolean; minutesSinceUpdate: number | null } {
  if (game.status === "final") return { label: "FINAL", live: false, minutesSinceUpdate: null };
  if (hasFreshLiveScore(game, now)) return { label: "LIVE", live: true, minutesSinceUpdate: 0 };
  if (game.status !== "live") return { label: "UPCOMING", live: false, minutesSinceUpdate: null };
  const timestamp = game.score_updated_at ? Date.parse(game.score_updated_at) : NaN;
  const age = now.getTime() - timestamp;
  return { label: "LAST UPDATE", live: false, minutesSinceUpdate: Number.isFinite(age) && age >= 0 ? Math.floor(age / 60_000) : null };
}
