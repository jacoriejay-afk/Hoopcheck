import type { SupabaseClient } from "@supabase/supabase-js";
export type ContactMessage = { id: string; request_id: string; sender_id: string; body: string; created_at: string };
export const CHAT_HISTORY_PAGE_SIZE = 50;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
export type HistoryCursor = Pick<ContactMessage,"id"|"created_at">;
export async function readConversationPage(client: SupabaseClient, requestId: string, signal: AbortSignal, before?: HistoryCursor): Promise<ContactMessage[]> {
  if (!uuid.test(requestId)) throw Error("Invalid conversation.");
  let query = client.from("player_contact_messages").select("id,request_id,sender_id,body,created_at")
    .eq("request_id",requestId).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(CHAT_HISTORY_PAGE_SIZE);
  if (before) {
    if (!uuid.test(before.id) || !timestamp.test(before.created_at) || !Number.isFinite(Date.parse(before.created_at))) throw Error("Invalid history cursor.");
    query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  }
  const {data,error} = await query.abortSignal(signal);
  if (error) throw Error("Conversation history could not be loaded. Try again.");
  return ((data ?? []) as ContactMessage[]).filter(row=>row.request_id===requestId);
}
export function appendConversationPage(previous: ContactMessage[], older: ContactMessage[]): ContactMessage[] {
  const seen = new Set(previous.map(row=>row.id));
  return [...previous,...older.filter(row=>{if(seen.has(row.id))return false;seen.add(row.id);return true;})];
}
export function matchesConversationSearch(query:string, name:string, username?:string|null) {
  const term=query.trim().toLocaleLowerCase();
  return !term || name.toLocaleLowerCase().includes(term) || Boolean(username && ("@"+username).toLocaleLowerCase().includes(term));
}
