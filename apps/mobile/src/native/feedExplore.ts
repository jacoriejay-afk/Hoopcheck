import type { FeedPost } from "./feedClient";
export const exploreFilters = ["all", "discussion", "media", "polls"] as const;
export type ExploreFilter = typeof exploreFilters[number];
export type ExploreTarget = "posts" | "creators";
/** Permit international text but exclude PostgREST/LIKE control characters. */
export function cleanExploreSearch(value: string): string {
  return value.slice(0,100).replace(/[^\p{L}\p{M}\p{N} #\x27-]/gu," ").replace(/\s+/g," ").trim();
}
export function matchesFeedExplore(post: FeedPost, filter: ExploreFilter, search: string, target?: ExploreTarget): boolean {
  // Called ONLY on the existing authorized, unexpired and unblocked feed.
  // Defense in depth for the exact server query scope.
  const hasMedia = Boolean(post.video_url || post.image_url || post.image_urls?.some(Boolean));
  if (filter === "media" && !hasMedia) return false;
  if (filter === "polls" && post.post_kind !== "poll") return false;
  if (filter === "discussion" && (post.post_kind !== "discussion" || hasMedia)) return false;
  const terms = search.trim().slice(0, 100).toLowerCase().split(/\s+/).filter(Boolean);
  const fields = (target === "posts" ? [post.body] : target === "creators" ? [post.profiles?.display_name] : [post.body, post.profiles?.display_name]).filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  return terms.every(term => fields.includes(term));
}
