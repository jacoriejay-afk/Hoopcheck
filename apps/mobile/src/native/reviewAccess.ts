export type Review = { id: string; title: string | null; body: string | null; overall_rating: number | null; created_at: string };
export type ReviewAccess = { canReadFull: boolean; canWrite: boolean; reviews: Review[] };
export async function readReviewAccess(origin: string, token: string, id: string, signal?: AbortSignal, request: typeof fetch = fetch): Promise<ReviewAccess> {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) throw new Error("Invalid API origin");
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Invalid review request");
  url.pathname = "/api/review-access";
  url.searchParams.set("entityType", "womens-team"); url.searchParams.set("entityId", id);
  const response = await request(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal });
  if (!response.ok) throw new Error("Review access unavailable");
  const data = await response.json();
  if (!data || typeof data !== "object" || typeof data.canReadFull !== "boolean" || typeof data.canWrite !== "boolean") throw new Error("Invalid review response");
  const reviews: Review[] = data.canReadFull && Array.isArray(data.reviews) ? data.reviews.filter((r: unknown): r is Review => {
    if (!r || typeof r !== "object") return false;
    const row = r as Review;
    return typeof row.id === "string" && typeof row.created_at === "string" && (row.body === null || typeof row.body === "string") && (row.title === null || typeof row.title === "string") && (row.overall_rating === null || (typeof row.overall_rating === "number" && Number.isFinite(row.overall_rating) && row.overall_rating >= 0 && row.overall_rating <= 5));
  }).map((row: Review) => ({ id: row.id, title: row.title, body: row.body, overall_rating: row.overall_rating, created_at: row.created_at })) : [];
  return { canReadFull: data.canReadFull, canWrite: data.canWrite, reviews };
}
