/** LIVECHAT-1: presentation lifecycle. Database policies must enforce the same boundaries. */
export type ChatFixture = {
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  ends_at: string | null;
};
const FINISHED = new Set(["final", "finished"]);
const UNPLAYED = new Set(["cancelled", "canceled", "postponed", "abandoned"]);
const MINUTE = 60_000;
function timestamp(value: string | null): number | null {
  if (!value) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}
/** ends_at is only authoritative when supplied as the actual final whistle time. */
export function getGameChatState(game: ChatFixture, now: Date = new Date()): "upcoming" | "open" | "read-only" {
  const status = game.status.toLowerCase();
  if (UNPLAYED.has(status)) return "read-only";
  const tip = timestamp(game.scheduled_at) ?? timestamp(game.started_at);
  const finalAt = timestamp(game.ends_at);
  if (FINISHED.has(status)) {
    if (finalAt === null) return "read-only"; // Fail closed without verified final timestamp.
    return now.getTime() < finalAt + 120 * MINUTE ? "open" : "read-only";
  }
  if (tip === null) return status === "live" || status === "in_progress" ? "open" : "upcoming";
  if (now.getTime() < tip - 60 * MINUTE) return "upcoming";
  return "open";
}
export function chatOpeningTime(game: ChatFixture): Date | null {
  const tip = timestamp(game.scheduled_at) ?? timestamp(game.started_at);
  return tip === null ? null : new Date(tip - 60 * MINUTE);
}
