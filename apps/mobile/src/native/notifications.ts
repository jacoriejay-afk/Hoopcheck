import type { SupabaseClient } from "@supabase/supabase-js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Notice = { id: string; target_type: string; target_id: string; notification_type: string; title: string; body: string; read_at: string | null; created_at: string };
export const NOTIFICATION_PAGE_SIZE = 100;
export type NotificationCursor = Pick<Notice, "created_at" | "id">;
// Keep the original database timestamp, including microseconds, for stable keyset paging.
const cursorTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
export async function readNotifications(client: SupabaseClient, userId: string, before?: NotificationCursor) {
  if (!uuid.test(userId)) throw new Error("Invalid notification request");
  let query = client.from("notifications").select("id,target_type,target_id,notification_type,title,body,read_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(NOTIFICATION_PAGE_SIZE);
  if (before) {
    if (!uuid.test(before.id) || !cursorTimestamp.test(before.created_at) || !Number.isFinite(Date.parse(before.created_at))) throw new Error("Invalid notification history cursor");
    query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  }
  const result = await query;
  if (result.error) throw new Error("Alerts could not load. Try again.");
  return (result.data ?? []) as Notice[];
}
export async function markNotificationsRead(client: SupabaseClient, userId: string, now = new Date(), notificationId?: string) {
  if (!uuid.test(userId)) throw new Error("Invalid notification request");
  if (notificationId && !uuid.test(notificationId)) throw new Error("Invalid notification request");
  const readAt = now.toISOString();
  let query = client.from("notifications").update({ read_at: readAt }).eq("user_id", userId).is("read_at", null);
  if (notificationId) query = query.eq("id", notificationId);
  const result = await query.select("id");
  if (result.error) throw new Error("Alerts could not be marked as read. Try again.");
  return { ids: (result.data ?? []).map(row => row.id as string), readAt };
}
export function notificationPath(notice: Pick<Notice, "target_type" | "target_id">) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(notice.target_id)) return null;
  const route = { team: "teams", coach: "coaches", league: "leagues", "womens-team": "womens" }[notice.target_type];
  if (route) return `/${route}/${notice.target_id}`;
  return notice.target_type === "game" ? `/fan-live?gameId=${notice.target_id}` : null;
}
export function noticeMatches(notice: Notice, filter: string) {
  const review = ["review", "rating", "trust_score", "pay_warning"].includes(notice.notification_type);
  return filter === "all" || (filter === "unread" && !notice.read_at) || (filter === "games" && notice.target_type === "game") || (filter === "reviews" && review) || (filter === "clubs" && notice.target_type !== "game" && !review);
}

// Search only the already authorized, loaded activity rows. No query is sent to the server.
export function noticeSearchMatches(notice: Pick<Notice, "title" | "body" | "notification_type">, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const text = [notice.title, notice.body, notice.notification_type.replaceAll("_", " ")].join(" ").toLowerCase();
  return terms.every(term => text.includes(term));
}
