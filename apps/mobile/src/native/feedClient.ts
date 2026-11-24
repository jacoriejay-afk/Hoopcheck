import type { SupabaseClient } from "@supabase/supabase-js";
export const FEED_PAGE_SIZE = 20;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isFeedId = (value: string) => uuid.test(value);
export type FeedCursor = { id: string; created_at: string };
export type FeedPost = FeedCursor & { author_id: string; body: string | null; image_url: string | null; image_urls: string[] | null; video_url: string | null; post_kind: string; poll_options: string[] | null; expires_at: string | null; profiles: { display_name: string | null; account_type: string | null; avatar_url?: string | null; avatar_moderation_status?: string | null } | null };
export type FeedComment = FeedCursor & { author_id: string; body: string; parent_id: string | null; profiles: { display_name: string | null; avatar_url?: string | null; avatar_moderation_status?: string | null } | null };
function apiUrl(origin: string, path: string) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Invalid API origin");
  url.pathname = path;
  return url.toString();
}
function validCursor(cursor: FeedCursor) {
  return uuid.test(cursor.id) && /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(cursor.created_at) && Number.isFinite(Date.parse(cursor.created_at));
}
function readablePosts(client: SupabaseClient, now: Date) {
  return client.from("feed_posts").select("id,author_id,body,image_url,image_urls,video_url,post_kind,poll_options,created_at,expires_at,profiles:profiles!feed_posts_author_id_fkey(display_name,account_type,avatar_url,avatar_moderation_status)").eq("status", "approved").or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);
}
export async function readSharedFeedPost(client: SupabaseClient, userId: string, postId: string, now = new Date()): Promise<FeedPost | null> {
  if (!uuid.test(userId) || !uuid.test(postId)) throw new Error("Invalid shared post");
  const result = await readablePosts(client, now).eq("id", postId).maybeSingle();
  if (result.error) throw new Error("Shared post unavailable");
  const post = result.data as unknown as FeedPost | null;
  if (!post) return null;
  if (!validCursor(post) || !uuid.test(post.author_id) || (post.expires_at && (!Number.isFinite(Date.parse(post.expires_at)) || Date.parse(post.expires_at) <= now.getTime()))) return null;
  const archive = await client.from("feed_post_archives").select("post_id").eq("user_id", userId).eq("post_id", postId).maybeSingle();
  if (archive.error) throw new Error("Saved feed preferences unavailable");
  return archive.data ? null : { ...post, profiles: Array.isArray(post.profiles) ? post.profiles[0] ?? null : post.profiles };
}
export async function readFeedPage(client: SupabaseClient, userId: string, cursor?: FeedCursor, reels = false, now = new Date()) {
  if (!uuid.test(userId) || (cursor && !validCursor(cursor))) throw new Error("Invalid feed request");
  let query = readablePosts(client, now).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(FEED_PAGE_SIZE + 1);
  if (reels) query = query.not("video_url", "is", null);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const result = await query;
  if (result.error) throw new Error("Feed unavailable");
  const rows = (result.data ?? []) as unknown as FeedPost[];
  if (rows.some(row => !validCursor(row) || !uuid.test(row.author_id))) throw new Error("Invalid feed response");
  const page = rows.slice(0, FEED_PAGE_SIZE);
  const archiveResult = page.length ? await client.from("feed_post_archives").select("post_id").eq("user_id", userId).in("post_id", page.map(row => row.id)) : { data: [], error: null };
  if (archiveResult.error) throw new Error("Saved feed preferences unavailable");
  const archived = new Set((archiveResult.data ?? []).map(row => row.post_id));
  const posts = page.filter(row => !archived.has(row.id) && (!row.expires_at || (Number.isFinite(Date.parse(row.expires_at)) && Date.parse(row.expires_at) > now.getTime()))).map(row => ({ ...row, profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles }));
  return { posts, next: rows.length > FEED_PAGE_SIZE ? { id: page[page.length - 1].id, created_at: page[page.length - 1].created_at } : null };
}
export async function readFeedComments(client: SupabaseClient, postId: string, offset = 0) {
  if (!uuid.test(postId) || !Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid comment request");
  const result = await client.from("feed_post_comments").select("id,author_id,parent_id,body,created_at,profiles:profiles!feed_post_comments_author_id_fkey(display_name,avatar_url,avatar_moderation_status)").eq("post_id", postId).order("created_at").order("id").range(offset, offset + 50);
  if (result.error) throw new Error("Comments unavailable");
  const rows = (result.data ?? []) as unknown as FeedComment[];
  if (rows.some(row => !validCursor(row) || typeof row.body !== "string")) throw new Error("Invalid comments");
  return { comments: rows.slice(0, 50).map(row => ({ ...row, profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles })), more: rows.length > 50 };
}
export async function moderateFeedText(origin: string, token: string, kind: "post" | "comment", text: string, postId?: string, request: typeof fetch = fetch, parentId?: string) {
  const target = apiUrl(origin, "/api/hoopfeed/moderate");
  const clean = text.trim();
  if (!token || !clean || clean.length > (kind === "comment" ? 1000 : 2000) || (kind === "comment" && (!postId || !uuid.test(postId)))) throw new Error("Invalid post or comment");
  if (parentId && (kind !== "comment" || !uuid.test(parentId))) throw new Error("Invalid reply target");
  const form = new FormData(); form.append("kind", kind); form.append("text", clean);
  if (parentId) form.append("parent_id", parentId);
  if (kind === "post") { form.append("audience", "community"); form.append("post_kind", "discussion"); }
  else form.append("post_id", postId!);
  const response = await request(target, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, cache: "no-store", redirect: "error" });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.allowed !== true) throw new Error(typeof result?.message === "string" ? result.message.slice(0, 300) : "This content could not be published. Your draft is unchanged.");
  const comment = result?.comment;
  if (kind === "comment" && comment && comment.post_id === postId && validCursor(comment) && uuid.test(comment.author_id) && typeof comment.body === "string") return {
    id: comment.id as string, author_id: comment.author_id as string, body: comment.body as string, created_at: comment.created_at as string,
    parent_id: typeof comment.parent_id === "string" && uuid.test(comment.parent_id) ? comment.parent_id : null, profiles: null,
  } as FeedComment;
}
export function validatedPollOptions(input: unknown): string[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 4 || input.some(value => typeof value !== "string" || !value.trim() || value.trim().length > 60)) throw new Error("Polls need 2 to 4 answers, each up to 60 characters.");
  const options = (input as string[]).map(value => value.trim());
  if (new Set(options.map(value => value.toLowerCase())).size !== options.length) throw new Error("Poll answers must be different.");
  return options;
}
export async function publishFeedPoll(origin: string, token: string, question: string, input: readonly string[], request: typeof fetch = fetch) {
  const target = apiUrl(origin, "/api/hoopfeed/moderate"); const text = question.trim();
  const options = validatedPollOptions(input);
  if (!token || !text || text.length > 2000) throw new Error("Add a poll question of up to 2,000 characters.");
  const form = new FormData(); form.append("kind", "post"); form.append("text", text); form.append("post_kind", "poll"); form.append("poll_options", JSON.stringify(options)); form.append("audience", "community");
  const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await request(target, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, cache: "no-store", redirect: "error", signal: controller.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.allowed !== true) throw new Error(typeof result?.message === "string" ? result.message.slice(0, 300) : "Publication could not be confirmed. Refresh before retrying; your draft is kept.");
    // The current post endpoint acknowledges publication with { allowed: true };
    // unlike comments and reshares, ordinary posts do not return a post ID.
  } finally { clearTimeout(deadline); }
}
export async function authorizedFeedMedia(origin: string, projectOrigin: string, token: string, postId: string, reference: string, signal?: AbortSignal, request: typeof fetch = fetch) {
  const target = apiUrl(origin, "/api/hoopfeed/media");
  const project = new URL(projectOrigin);
  if (project.protocol !== "https:" || project.username || project.password || project.search || project.hash || project.pathname !== "/") throw new Error("Invalid storage origin");
  if (!token || !uuid.test(postId) || !reference || reference.length > 2048) throw new Error("Invalid media request");
  const response = await request(target, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ post_id: postId, media_url: reference }), cache: "no-store", redirect: "error", signal });
  if (!response.ok) throw new Error("Media access could not be verified");
  const result = await response.json();
  const url = new URL(result.url);
  if (url.protocol !== "https:" || url.origin !== project.origin || !url.pathname.startsWith("/storage/v1/object/sign/") || url.username || url.password) throw new Error("Invalid signed media URL");
  return url.toString();
}
export async function readFeedChecks(client: SupabaseClient, ids: string[]) {
  if (ids.length > FEED_PAGE_SIZE + 1 || ids.some(id => !uuid.test(id))) throw new Error("Invalid check request");
  if (!ids.length) return [];
  const result = await client.rpc("get_hoopfeed_check_totals", { post_ids: ids });
  if (result.error || !Array.isArray(result.data)) throw new Error("Checks unavailable");
  // The installed SQL aggregates FROM feed_post_checks, so a post with zero
  // checks produces no GROUP BY row. Missing rows after a successful RPC mean
  // zero; RPC failures must never be converted to fake counts.
  const requested = new Set(ids);
  const totals = new Map<string, { post_id: string; checks_count: number; checked_by_me: boolean }>();
  for (const row of result.data) {
    const count = Number(row?.checks_count);
    if (!row || !requested.has(row.post_id) || totals.has(row.post_id)
      || !Number.isSafeInteger(count) || count < 0 || typeof row.checked_by_me !== "boolean") {
      throw new Error("Invalid Check totals response");
    }
    totals.set(row.post_id, { post_id: row.post_id, checks_count: count, checked_by_me: row.checked_by_me });
  }
  return ids.map(post_id => totals.get(post_id) ?? { post_id, checks_count: 0, checked_by_me: false });
}
export async function toggleFeedCheck(client: SupabaseClient, userId: string, postId: string, currentlyChecked: boolean) {
  if (!uuid.test(userId) || !uuid.test(postId)) throw new Error("Invalid check request");
  const result = currentlyChecked ? await client.from("feed_post_checks").delete().eq("post_id", postId).eq("user_id", userId) : await client.from("feed_post_checks").insert({ post_id: postId, user_id: userId });
  if (result.error) throw new Error("Check could not be confirmed");
  return readFeedChecks(client, [postId]);
}
export async function feedAction(origin: string, token: string, kind: "vote" | "bookmark", postId: string, value: number | boolean, request: typeof fetch = fetch) {
  const target = apiUrl(origin, "/api/hoopfeed/moderate");
  if (!token || !uuid.test(postId) || (kind === "vote" ? !Number.isInteger(value) || Number(value) < 0 || Number(value) > 5 : typeof value !== "boolean")) throw new Error("Invalid feed action");
  const form = new FormData(); form.append("kind", kind); form.append("post_id", postId);
  form.append(kind === "vote" ? "option_index" : "saved", String(value));
  const response = await request(target, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, cache: "no-store", redirect: "error" });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.allowed !== true) throw new Error(typeof result?.message === "string" ? result.message.slice(0, 300) : "This action could not be confirmed.");
}
export async function readPollTotals(client: SupabaseClient, postId: string) {
  if (!uuid.test(postId)) throw new Error("Invalid poll");
  const result = await client.rpc("get_hoopfeed_poll_totals", { post_ids: [postId] });
  if (result.error) throw new Error("Poll unavailable");
  return (result.data ?? []) as { option_index: number; votes_count: number; voted_by_me: boolean }[];
}
export async function readFeedSaved(client: SupabaseClient, userId: string, ids: string[]) {
  if (!uuid.test(userId) || ids.length > FEED_PAGE_SIZE + 1 || ids.some(id => !uuid.test(id))) throw new Error("Invalid saved-post request");
  if (!ids.length) return [];
  const result = await client.from("feed_post_bookmarks").select("post_id").eq("user_id", userId).in("post_id", ids);
  if (result.error) throw new Error("Saved post state unavailable");
  return (result.data ?? []).map(row => row.post_id as string).filter(id => ids.includes(id));
}

/** Owner-scoped post deletion. A zero-row response is not a confirmed delete. */
export async function deleteOwnedFeedPost(client: SupabaseClient, userId: string, postId: string) {
  if (!uuid.test(userId) || !uuid.test(postId)) throw new Error("Invalid post deletion request");
  const result = await client.from("feed_posts").delete().eq("id", postId)
    .eq("author_id", userId).select("id");
  if (result.error || !Array.isArray(result.data) || result.data.length !== 1 || result.data[0]?.id !== postId)
    throw new Error("This post could not be deleted. Try refreshing the feed.");
}

/** Deliver only a post identifier through the authenticated server's recipient authorization. */
export async function sendFeedShare(origin: string, token: string, postId: string, recipientId: string, signal?: AbortSignal, request: typeof fetch = fetch) {
  if (!token || !uuid.test(postId) || !uuid.test(recipientId)) throw new Error("Invalid share request");
  const response = await request(apiUrl(origin, "/api/hoopfeed/share"), { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ post_id: postId, recipient_id: recipientId }), cache: "no-store", redirect: "error", signal });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new Error(typeof result?.message === "string" ? result.message.slice(0, 250) : "Share could not be confirmed.");
}
