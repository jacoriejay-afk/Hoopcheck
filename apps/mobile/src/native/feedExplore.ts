import type { FeedPost } from "./feedClient";
export const exploreFilters = ["all", "discussion", "media", "polls"] as const;
export type ExploreFilter = typeof exploreFilters[number];
export function matchesFeedExplore(post: FeedPost, filter: ExploreFilter, search: string): boolean {
  // Called ONLY on the existing authorized, unexpired and unblocked feed.
  // No new query, permission, ranking, location discovery or data source.
  const hasMedia = Boolean(post.video_url || post.image_url || post.image_urls?.some(Boolean));
  if (filter === "media" && !hasMedia) return false;
  if (filter === "polls" && post.post_kind !== "poll") return false;
  if (filter === "discussion" && (post.post_kind !== "discussion" || hasMedia)) return false;
  const terms = search.trim().slice(0, 100).toLowerCase().split(/\s+/).filter(Boolean);
  const fields = [post.body, post.profiles?.display_name].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  return terms.every(term => fields.includes(term));
}
