/**
 * Status displayed to fans must not invent a final whistle from elapsed time.
 * A provider-confirmed final does not carry an in-progress quarter label.
 * These rules only affect presentation; Supabase/RLS governs chat permissions.
 */
export type LiveGameStatusInput = {
  status: string;
  period_label?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  ends_at?: string | null;
};

export type LiveGameStatusPresentation = {
  label: string;
  isVerifiedLive: boolean;
  isVerifiedFinal: boolean;
  isUnverified: boolean;
  showPeriod: boolean;
};

const ACTIVE_PERIOD = /^(?:q[1-4]|quarter\s*[1-4]|(?:first|second|third|fourth)\s+quarter|half[\s-]?time|break\s*time|bt|ht|ot\d*|overtime)$/i;
const FOUR_HOURS = 4 * 60 * 60_000;

export function getLiveGameStatusPresentation(game: LiveGameStatusInput, now = new Date()): LiveGameStatusPresentation {
  const status = (game.status || "").trim().toLowerCase();
  const period = (game.period_label || "").trim();
  const isFinal = status === "final" || status === "finished";
  const isLive = status === "live" || status === "in_progress";

  // Existing provider-backed rows may have been auto-finalized at the four-hour
  // timeout, leaving a Q1 / halftime label and partial score in the database.
  const conflictingFinal = isFinal && ACTIVE_PERIOD.test(period);
  const tip = Date.parse(game.started_at || game.scheduled_at || "");
  const end = Date.parse(game.ends_at || "");
  const staleLive = isLive && !Number.isFinite(end) && Number.isFinite(tip) &&
    now.getTime() >= tip + FOUR_HOURS;

  const isUnverified = conflictingFinal || staleLive;
  const isVerifiedLive = isLive && !staleLive;
  const isVerifiedFinal = isFinal && !conflictingFinal;
  let label = "STATUS UNKNOWN";
  if (conflictingFinal) label = "RESULT PENDING";
  else if (staleLive) label = "UPDATE DELAYED";
  else if (isVerifiedLive) label = "LIVE";
  else if (isVerifiedFinal) label = "FINAL";
  else if (status === "scheduled") label = "UPCOMING";
  else if (status === "postponed") label = "POSTPONED";
  else if (["cancelled", "canceled", "abandoned"].includes(status)) label = "CANCELLED";

  return { label, isVerifiedLive, isVerifiedFinal, isUnverified, showPeriod: isVerifiedLive && Boolean(period) };
}
