import type { LiveGame } from "./liveGames";

/** Provider receipt age is distinct from the last local database poll.
 * No timestamp means freshness is unverified, not a new provider update.
 */
export const GAME_PAST_WINDOW_MS = 36 * 60 * 60 * 1000;
export const GAME_FUTURE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_REPORTED_LIVE_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_LAST_CHECK_AGE_MS = 2 * 60 * 1000;
// One scheduled slot may be devoted to tomorrow's fixtures; 30 minutes is
// the maximum acceptable receipt age, not a promise of real-time scoring.
export const MAX_PROVIDER_RECEIPT_AGE_MS = 30 * 60 * 1000;

export type GameDisplayState = {
  kind: "live" | "upcoming" | "final" | "awaiting" | "cancelled" | "postponed" | "unverified";
  label: string;
  isLive: boolean;
  needsVerification: boolean;
};

export function gameDisplayState(
  game: Pick<LiveGame, "status" | "scheduled_at" | "started_at" | "score_updated_at">,
  nowMs = Date.now(),
  lastCheckedMs: number | null = null,
): GameDisplayState {
  const raw = (game.status || "").trim().toLowerCase();
  const tip = Date.parse(game.started_at || game.scheduled_at || "");
  const scheduled = Date.parse(game.scheduled_at || "");
  const checkedIsStale = lastCheckedMs !== null
    && (!Number.isFinite(lastCheckedMs) || nowMs - lastCheckedMs > MAX_LAST_CHECK_AGE_MS || lastCheckedMs > nowMs + 60_000);
  const receipt = Date.parse(game.score_updated_at || "");
  const providerIsFresh = Number.isFinite(receipt) && receipt <= nowMs + 60_000
    && nowMs - receipt <= MAX_PROVIDER_RECEIPT_AGE_MS;
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
      || nowMs - tip > MAX_REPORTED_LIVE_AGE_MS || checkedIsStale || !providerIsFresh) return awaiting;
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

/** Label the successful provider snapshot receipt, never a score-change time. */
export function providerReceiptLabel(value?: string | null, nowMs = Date.now()): string {
  const elapsed = nowMs - Date.parse(value || "");
  if (!Number.isFinite(elapsed) || elapsed < -60_000) return "Provider refresh not verified";
  if (elapsed < 60_000) return "Provider checked just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return "Provider checked " + minutes + " min ago";
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? "Provider checked " + hours + " hr ago" : "Provider checked " + Math.floor(hours/24) + " d ago";
}
