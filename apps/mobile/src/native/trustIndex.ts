export type TrustEntity = "team" | "womens-team";
export type TrustIndex = { status: "locked" } | { status: "available"; score: number | null; reviews: number; verified: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseTrustIndex(input: unknown, id: string): TrustIndex {
  if (!input || typeof input !== "object") throw new Error("Invalid Trust Index response");
  const scores = (input as { scores?: Record<string, unknown> }).scores;
  if (!scores || !Object.prototype.hasOwnProperty.call(scores, id)) throw new Error("Missing Trust Index");
  const row = scores[id];
  if (!row || typeof row !== "object") throw new Error("Invalid Trust Index");
  const value = row as Record<string, unknown>;
  if (value.locked === true) return { status: "locked" };
  const { score, reviewCount, verifiedReviewCount } = value;
  if ((value.locked !== undefined && value.locked !== false) ||
      typeof value.tier !== "string" ||
      typeof reviewCount !== "number" || !Number.isSafeInteger(reviewCount) || reviewCount < 0 ||
      typeof verifiedReviewCount !== "number" || !Number.isSafeInteger(verifiedReviewCount) || verifiedReviewCount < 0 || verifiedReviewCount > reviewCount ||
      !(score === null || (typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 100 && reviewCount > 0))) throw new Error("Invalid Trust Index");
  return { status: "available", score, reviews: reviewCount, verified: verifiedReviewCount };
}
export async function readTrustIndex(origin: string, token: string, entity: TrustEntity, id: string, signal?: AbortSignal, request: typeof fetch = fetch): Promise<TrustIndex> {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "") ||
      !token || !uuid.test(id) || !["team", "womens-team"].includes(entity)) throw new Error("Invalid Trust Index request");
  url.pathname = "/api/trust-score";
  url.searchParams.set("entityType", entity);
  // Batch read deliberately avoids the singular endpoint's snapshot/notification side effects.
  url.searchParams.set("entityIds", id);
  const response = await request(url.toString(), { headers: { Authorization: "Bearer " + token }, cache: "no-store", redirect: "error", signal });
  if (!response.ok) throw new Error("Trust Index unavailable");
  return parseTrustIndex(await response.json(), id);
}
