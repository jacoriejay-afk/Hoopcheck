/** HOOPDATA-1: conservative provider validation; never infer an unknown score or timestamp. */
export function validatedProviderScore(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export function validateProviderSnapshot(games: unknown[]): boolean {
  const seen = new Set<string>();
  for (const game of games) {
    if (!game || typeof game !== "object" || !("id" in game)) return false;
    const value = game.id;
    if (!(typeof value === "number" && Number.isSafeInteger(value) && value > 0) &&
        !(typeof value === "string" && /^[1-9][0-9]*$/.test(value))) return false;
    const id = String(value);
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}
export function providerTipoff(timestamp: unknown, date: unknown): string | null {
  if (typeof timestamp === "number" && Number.isSafeInteger(timestamp) && timestamp > 0) {
    const parsed = new Date(timestamp * 1000);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  // A timezone-free string must not be interpreted in the server's local timezone.
  if (typeof date !== "string" || !/T.*(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(date)) return null;
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
/** Snapshot receipt is not a provider event timestamp. Use honest freshness labels. */
export function scoreSnapshotFreshness(updatedAt: unknown, now: Date): "fresh" | "delayed" | "unknown" {
  if (typeof updatedAt !== "string" || !Number.isFinite(now.getTime())) return "unknown";
  const observed = Date.parse(updatedAt);
  const age = now.getTime() - observed;
  if (!Number.isFinite(age) || age < 0) return "unknown";
  // 15-minute scheduled sync plus grace for scheduler delays.
  return age > 25 * 60_000 ? "delayed" : "fresh";
}
