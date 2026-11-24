import type { LiveGame } from "./liveGames";

/** Client-facing provider honesty. The record has no provider updated_at column,
 * so this never claims a provider score was updated when we only polled the DB.
 */
export const GAME_PAST_WINDOW_MS = 36 * 60 * 60 * 1000;
export const GAME_FUTURE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_REPORTED_LIVE_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_LAST_CHECK_AGE_MS = 2 * 60 * 1000;

export type GameDisplayState = {
  kind: "live" | "upcoming" | "final" | "awaiting" | "cancelled" | "postponed" | "unverified";
  label: string;
  isLive: boolean;
  needsVerification: boolean;
};

export function gameDisplayState(
  game: Pick<LiveGame, "status" | "scheduled_at" | "started_at">,
  nowMs = Date.now(),
  lastCheckedMs: number | null = null,
): GameDisplayState {
  const raw = (game.status || "").trim().toLowerCase();
  const tip = Date.parse(game.started_at || game.scheduled_at || "");
  const scheduled = Date.parse(game.scheduled_at || "");
  const checkedIsStale = lastCheckedMs !== null
    && (!Number.isFinite(lastCheckedMs) || nowMs - lastCheckedMs > MAX_LAST_CHECK_AGE_MS || lastCheckedMs > nowMs + 60_000);
  const awaiting = { kind: "awaiting", label: "Awaiting score update", isLive: false, needsVerification: true } as const;
  if (raw === "final" || raw === "finished") {
    return { kind: "final", label: "FINAL", isLive: false, needsVerification: false };
  }
  if (raw === "cancelled" || raw === "abandoned") {
    return { kind: "cancelled", label: raw === "abandoned" ? "ABANDONED" : "CANCELLED", isLive: false, needsVerification: false };
  }
  if (raw === "postponed") return { kind: "postponed", label: "POSTPONED", isLive: false, needsVerification: false };
  if (raw === "live") {
    if (!Number.isFinite(tip) || tip > nowMs + 30 * 60_000
      || nowMs - tip > MAX_REPORTED_LIVE_AGE_MS || checkedIsStale) return awaiting;
    return { kind: "live", label: "● LIVE", isLive: true, needsVerification: false };
  }
  if (raw === "scheduled") {
    if (!Number.isFinite(scheduled)) return { kind: "unverified", label: "TIP-OFF UNCONFIRMED", isLive: false, needsVerification: true };
    if (scheduled < nowMs - 15 * 60_000) return awaiting;
    if (checkedIsStale && scheduled <= nowMs) return awaiting;
    return { kind: "upcoming", label: "UPCOMING", isLive: false, needsVerification: false };
  }
  return { kind: "unverified", label: "STATUS UNVERIFIED", isLive: false, needsVerification: true };
}

/** A DB poll time is not a source-updated timestamp. */
export function lastCheckedLabel(lastCheckedMs: number, nowMs = Date.now()): string {
  const elapsed = nowMs - lastCheckedMs;
  if (!Number.isFinite(elapsed) || elapsed < -60_000) return "Check time unavailable";
  if (elapsed < 60_000) return "Checked just now";
  const mins = Math.floor(elapsed / 60_000);
  if (mins < 60) return `Checked ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `Checked ${hours} hr ago` : `Checked ${Math.floor(hours / 24)} d ago`;
}
