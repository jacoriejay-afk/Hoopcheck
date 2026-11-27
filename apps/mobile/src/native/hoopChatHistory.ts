import type { SupabaseClient } from "@supabase/supabase-js";
export type ContactMessage = { id: string; request_id: string; sender_id: string; body: string; created_at: string; reply_to_id?: string | null };
export const CHAT_HISTORY_PAGE_SIZE = 50;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
export type HistoryCursor = Pick<ContactMessage,"id"|"created_at">;
export async function readConversationPage(client: SupabaseClient, requestId: string, signal: AbortSignal, before?: HistoryCursor, verifiedBearer?: string, structuredReplies = false): Promise<ContactMessage[]> {
  if (!uuid.test(requestId)) throw Error("Invalid conversation.");
  let query = client.from("player_contact_messages").select(structuredReplies ? "id,request_id,sender_id,body,created_at,reply_to_id" : "id,request_id,sender_id,body,created_at")
    .eq("request_id",requestId).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(CHAT_HISTORY_PAGE_SIZE);
  if (before) {
    if (!uuid.test(before.id) || !timestamp.test(before.created_at) || !Number.isFinite(Date.parse(before.created_at))) throw Error("Invalid history cursor.");
    query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  }
  if (verifiedBearer !== undefined) {
    if (!/^Bearer [^\s]+$/.test(verifiedBearer)) throw Error("Invalid conversation session.");
    query = query.setHeader("Authorization",verifiedBearer);
  }
  if (signal.aborted) throw Error("Conversation history check expired.");
  const {data,error} = await query.abortSignal(signal);
  if (error) throw Error("Conversation history could not be loaded. Try again.");
  const rows: unknown = data ?? [];
  if (!Array.isArray(rows) || rows.length > CHAT_HISTORY_PAGE_SIZE) throw Error("Invalid conversation history.");
  return rows.filter((row): row is ContactMessage => Boolean(row && typeof row === "object" && row.request_id === requestId && typeof row.id === "string" && uuid.test(row.id) && typeof row.sender_id === "string" && uuid.test(row.sender_id) && typeof row.body === "string" && typeof row.created_at === "string" && timestamp.test(row.created_at) && Number.isFinite(Date.parse(row.created_at)) && (!structuredReplies || row.reply_to_id === null || (typeof row.reply_to_id === "string" && uuid.test(row.reply_to_id)))));
}
export function appendConversationPage(previous: ContactMessage[], older: ContactMessage[]): ContactMessage[] {
  const seen = new Set(previous.map(row=>row.id));
  return [...previous,...older.filter(row=>{if(seen.has(row.id))return false;seen.add(row.id);return true;})];
}
export function refreshConversationPage(previous: ContactMessage[], newest: ContactMessage[]) {
  if (newest.length < CHAT_HISTORY_PAGE_SIZE) return newest;
  const oldestNewestId = newest[newest.length - 1].id;
  const boundary = previous.findIndex(row => row.id === oldestNewestId);
  return boundary < 0 ? newest : appendConversationPage(newest, previous.slice(boundary + 1));
}
export function matchesConversationSearch(query:string, name:string, username?:string|null) {
  const term=query.trim().toLocaleLowerCase();
  return !term || name.toLocaleLowerCase().includes(term) || Boolean(username && ("@"+username).toLocaleLowerCase().includes(term));
}
