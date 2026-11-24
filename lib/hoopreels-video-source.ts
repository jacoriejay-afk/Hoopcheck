/**
 * Build 12 / HOOPREELS-1 A. Only an explicitly curated, server-authorized
 * adaptive stream is a Reel source. A feed_posts.video_url is NEVER a source.
 * The provider-specific validation is here, not in the player/UI.
 */
export const HOOPREELS_CREATE_ENABLED = false as const;
export const REEL_CATALOG_LIMIT = 20;
export const REEL_MAX_SECONDS = 60;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const providerId = /^[a-zA-Z0-9_-]{8,120}$/;
export type ReelVideoSource = {
  provider: "mux"; postId: string; playbackId: string;
  hlsUrl: string; posterUrl: string; duration: number;
  width: number; height: number; expiresAt: number;
};
export function isReelId(value: unknown): value is string { return typeof value === "string" && uuid.test(value); }
function signedUrl(value: unknown, host: string, path: RegExp): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host && !url.port && !url.username &&
      !url.password && !url.hash && path.test(url.pathname) &&
      url.searchParams.getAll("token").length === 1 &&
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(url.searchParams.get("token") || "");
  } catch { return false; }
}
export function resolveVideoSource(value: unknown, now = Date.now()): ReelVideoSource | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.provider !== "mux" || !isReelId(v.postId) || typeof v.playbackId !== "string" || !providerId.test(v.playbackId)) return null;
  const id = v.playbackId;
  if (!signedUrl(v.hlsUrl, "stream.mux.com", new RegExp("^/" + id + "\\.m3u8$")) ||
      !signedUrl(v.posterUrl, "image.mux.com", new RegExp("^/" + id + "/thumbnail\\.(jpg|jpeg|png|webp)$"))) return null;
  const duration = v.duration, width = v.width, height = v.height, expiresAt = v.expiresAt;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0 || duration > REEL_MAX_SECONDS ||
      typeof width !== "number" || typeof height !== "number" || !Number.isInteger(width) || !Number.isInteger(height) ||
      Math.min(width, height) <= 0 || Math.min(width, height) > 1080 || Math.max(width, height) > 1920 ||
      typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt) || expiresAt <= now + 90_000) return null;
  return { provider: "mux", postId: v.postId, playbackId: id, hlsUrl: v.hlsUrl, posterUrl: v.posterUrl, duration, width, height, expiresAt };
}
/**
 * Operator-only catalog of previously issued signed HLS and poster URLs.
 * Never accept entries from a post body, a caller or an EXPO_PUBLIC variable.
 * No configured provider/catalog => no playback; tokens must be refreshed by
 * the provider operator. This is not a resumable upload or signing integration.
 */
export function curatedReelCatalog(provider: string | undefined, raw: string | undefined, now = Date.now()) {
  if (provider !== "mux" || !raw || raw.length > 300_000) return { configured: false, assets: [] as ReelVideoSource[] };
  try {
    const input: unknown = JSON.parse(raw);
    if (!Array.isArray(input) || input.length > REEL_CATALOG_LIMIT) return { configured: false, assets: [] as ReelVideoSource[] };
    const assets = input.map(value => resolveVideoSource(value, now));
    if (assets.some(asset => !asset) || new Set(assets.map(asset => asset?.postId)).size !== assets.length) return { configured: false, assets: [] as ReelVideoSource[] };
    return { configured: true, assets: assets.filter((asset): asset is ReelVideoSource => Boolean(asset)) };
  } catch { return { configured: false, assets: [] as ReelVideoSource[] }; }
}
export type ReelRankInput = { id: string; created_at: string; author_id: string; club_id?: string | null; womens_club_id?: string | null; league_id?: string | null; womens_league_id?: string | null };
export function isFollowedReel(row: ReelRankInput, followed: ReadonlySet<string>) {
  return followed.has(row.author_id) || [row.club_id, row.womens_club_id, row.league_id, row.womens_league_id].some(id => Boolean(id && followed.has(id)));
}
/** For You v1: time-decaying recency, capped lifetime Checks/hour (a velocity
 * proxy until interval analytics exist), plus real followed team/league/user
 * affinity. No ML, no generated scores. Rank once on a catalog refresh. */
export function rankReels<T extends ReelRankInput>(rows: readonly T[], checks: Record<string, number>, followed: ReadonlySet<string>, now = Date.now()): T[] {
  const score = (r: T) => {
    const age = Math.max(1, (now - Date.parse(r.created_at)) / 3_600_000);
    const count = checks[r.id];
    const velocity = Number.isFinite(count) && count >= 0 ? Math.min(10, count / age) : 0;
    return 12 / (1 + age / 24) + velocity + (isFollowedReel(r, followed) ? 5 : 0);
  };
  return [...rows].sort((a,b) => score(b) - score(a) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}
