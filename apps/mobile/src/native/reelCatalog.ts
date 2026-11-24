import type { FeedPost } from "./feedClient";
import { isReelId, REEL_CATALOG_LIMIT, resolveVideoSource } from "../../../../lib/hoopreels/video-source";

/** Only call this provider catalog, never the ordinary raw-media reader. */
export async function requestReelCatalog(origin: string, token: string, signal: AbortSignal, request: typeof fetch = fetch) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !token) throw Error("Invalid Reel request");
  url.pathname = "/api/hoopreels/catalog";
  const response = await request(url.toString(), { headers: { Authorization: "Bearer " + token }, cache: "no-store", redirect: "error", signal });
  if (!response.ok) throw Error("HoopReels streaming is unavailable.");
  const value = await response.json();
  if (typeof value?.configured !== "boolean" || !Array.isArray(value?.posts) || value.posts.length > REEL_CATALOG_LIMIT) throw Error("Invalid Reel catalog.");
  if (!value.configured) return { configured: false, posts: [] as FeedPost[], next: null };
  const posts: FeedPost[] = [];
  for (const post of value.posts) {
    const source = resolveVideoSource(post?.reel_source);
    if (!source || !isReelId(post.id) || source.postId !== post.id || !isReelId(post.author_id) ||
        typeof post.created_at !== "string" || !Number.isFinite(Date.parse(post.created_at)) ||
        (post.expires_at && (!Number.isFinite(Date.parse(post.expires_at)) || Date.parse(post.expires_at) <= Date.now()))) continue;
    posts.push({ ...post, video_url: null, reel_source: source });
  }
  return { configured: true, posts, next: null };
}
