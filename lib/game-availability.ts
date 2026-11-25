export type GameStatus = "scheduled" | "live" | "final" | "cancelled" | string;
export type GameAvailabilityState = "LIVE" | "POST GAME" | "OPENS SOON" | "UPCOMING" | "CLOSED";
export type GameAvailabilityPhase = "pre-game" | "in-game" | "post-game" | "closed" | "schedule-unknown";

export type GameAvailabilityInput = {
  status: GameStatus;
  scheduledAt: string | null;
  startedAt?: string | null;
  endsAt?: string | null;
  now?: Date;
};

export type GameAvailability = {
  state: GameAvailabilityState;
  phase: GameAvailabilityPhase;
  chatOpen: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  minutesUntilOpen: number | null;
  reason: string;
};

const MINUTE = 60_000;
export const GAME_CHAT_OPEN_EARLY_MINUTES = 60;
export const GAME_CHAT_POST_GAME_MINUTES = 120;
const MAX_GAME_WINDOW_HOURS = 4;

/**
 * Single source of truth for game-card state and chat access.
 * The state represents chat availability; phase distinguishes a post-game
 * discussion from a game currently in progress.
 */
export function getGameAvailability({
  status,
  scheduledAt,
  startedAt = null,
  endsAt = null,
  now = new Date(),
}: GameAvailabilityInput): GameAvailability {
  const normalizedStatus = status.toLowerCase();
  const cancelled = normalizedStatus === "cancelled" || normalizedStatus === "canceled";
  const terminalUnknown = normalizedStatus === "postponed" || normalizedStatus === "abandoned";
  if (cancelled || terminalUnknown) {
    return {
      state: "CLOSED", phase: "closed", chatOpen: false, opensAt: null, closesAt: null,
      minutesUntilOpen: null, reason: "This game is no longer scheduled to take place.",
    };
  }

  const scheduled = scheduledAt ? Date.parse(scheduledAt) : Number.NaN;
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  const ended = endsAt ? Date.parse(endsAt) : Number.NaN;
  const tipoffMs = Number.isFinite(scheduled) ? scheduled : started;
  const hasTipoff = Number.isFinite(tipoffMs);
  const liveStatus = normalizedStatus === "live" || normalizedStatus === "in_progress";
  const finalStatus = normalizedStatus === "final" || normalizedStatus === "finished";

  if (!hasTipoff) {
    if (liveStatus) {
      return {
        state: "LIVE", phase: "schedule-unknown", chatOpen: true, opensAt: null, closesAt: null,
        minutesUntilOpen: null, reason: "The provider marks this game live, but schedule timestamps are unavailable.",
      };
    }
    return {
      state: "UPCOMING", phase: "schedule-unknown", chatOpen: false, opensAt: null, closesAt: null,
      minutesUntilOpen: null, reason: "Waiting for a confirmed tip-off time from the game provider.",
    };
  }

  // Without a provider-confirmed finish timestamp, do not manufacture a
  // two-hour post-game window from the scheduled start time.
  if (finalStatus && !Number.isFinite(ended)) {
    return {
      state: "CLOSED", phase: "closed", chatOpen: false, opensAt: null, closesAt: null,
      minutesUntilOpen: null, reason: "Waiting for a verified final timestamp.",
    };
  }

  const opensMs = tipoffMs - GAME_CHAT_OPEN_EARLY_MINUTES * MINUTE;
  const closesMs = Number.isFinite(ended)
    ? ended + GAME_CHAT_POST_GAME_MINUTES * MINUTE
    : tipoffMs + MAX_GAME_WINDOW_HOURS * 60 * MINUTE;
  const opensAt = new Date(opensMs);
  const closesAt = new Date(closesMs);
  const minutesUntilOpen = Math.max(0, Math.ceil((opensMs - now.getTime()) / MINUTE));

  if (now.getTime() < opensMs) {
    return {
      state: "UPCOMING", phase: "pre-game", chatOpen: false, opensAt, closesAt,
      minutesUntilOpen, reason: `Chat opens ${GAME_CHAT_OPEN_EARLY_MINUTES} minutes before tip-off.`,
    };
  }

  if (now.getTime() >= closesMs || (finalStatus && now.getTime() >= closesMs)) {
    return {
      state: "CLOSED", phase: "closed", chatOpen: false, opensAt, closesAt,
      minutesUntilOpen: null, reason: "The chat window for this game has closed.",
    };
  }

  if (!liveStatus && now.getTime() < tipoffMs) {
    return {
      state: "OPENS SOON", phase: "pre-game", chatOpen: true, opensAt, closesAt,
      minutesUntilOpen: 0, reason: "Chat is open before tip-off.",
    };
  }

  return {
    state: finalStatus ? "POST GAME" : "LIVE",
    phase: finalStatus ? "post-game" : "in-game",
    chatOpen: true,
    opensAt,
    closesAt,
    minutesUntilOpen: 0,
    reason: finalStatus ? "Post-game chat is still open." : "Chat is open for this game.",
  };
}

/**
 * Fail-closed chat access gate until the separately reviewed postgame RLS
 * migration is deployed and the public rollout flag is explicitly enabled.
 * Keep getGameAvailability provider/lifecycle semantics for informational UI.
 * The database room RPC and RLS must independently authorize every write.
 */
export function isGameChatOpen(input: GameAvailabilityInput, postgameEnabled = false): boolean {
  const availability = getGameAvailability(input);
  return availability.chatOpen && (availability.phase !== "post-game" || postgameEnabled);
}

/** Format stored timestamps in the viewer's local timezone. Never expose raw UTC. */
export function formatViewerLocalTime(value: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Tip-off time not confirmed";
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  });
}

/** Group upcoming fixtures by viewer-local calendar dates, not fixed 24-hour days. */
export function getViewerUpcomingTimeBucket(value: string | null, now: Date): string {
  const tip = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(tip)) return "Time unconfirmed";
  if (tip <= now.getTime() + 60 * MINUTE) return "Starting within the hour";
  const localTip = new Date(tip);
  if (localTip.toDateString() === now.toDateString()) return "Tonight / Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return localTip.toDateString() === tomorrow.toDateString() ? "Tomorrow" : "Later";
}

/** Countdown is informational: only a provider-scheduled future tip-off qualifies. */
export function formatPregameCountdown(status: GameStatus, scheduledAt: string | null, now: Date): string | null {
  if (status.trim().toLowerCase() !== "scheduled" || !scheduledAt) return null;
  const remaining = Date.parse(scheduledAt) - now.getTime();
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const minutes = Math.ceil(remaining / MINUTE);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = [days ? `${days}d` : "", hours ? `${hours}h` : "", mins ? `${mins}m` : ""].filter(Boolean);
  return `Tip-off in ${parts.join(" ")}`;
}
