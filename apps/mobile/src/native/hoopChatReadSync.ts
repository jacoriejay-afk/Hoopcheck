import type { SupabaseClient } from "@supabase/supabase-js";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
type ReadSession = { bearer: string; signal: AbortSignal };

export async function readServerChatCounts(client: SupabaseClient, threadIds: string[], session: ReadSession) {
  const validIds = new Set(threadIds);
  if (validIds.size > 100 || [...validIds].some(id => !uuid.test(id))) {
    throw Error("Invalid conversation list.");
  }
  const counts = new Map<string, number>();
  if (!validIds.size) return counts;
  const result = await client.rpc("get_hoopchat_unread", { p_request_ids: [...validIds] })
    .setHeader("Authorization", session.bearer).abortSignal(session.signal);
  if (result.error || session.signal.aborted || !Array.isArray(result.data) || result.data.length > validIds.size) {
    throw Error("Synced unread counts are unavailable.");
  }
  for (const row of result.data) {
    if (!row || !validIds.has(row.request_id) || counts.has(row.request_id)
        || !Number.isInteger(row.unread_count) || row.unread_count < 0 || row.unread_count > 100) {
      throw Error("Unexpected unread counts.");
    }
    counts.set(row.request_id, row.unread_count);
  }
  return counts;
}

export async function markServerChatRead(client: SupabaseClient, threadId: string, messageId: string, session: ReadSession) {
  if (!uuid.test(threadId) || !uuid.test(messageId) || session.signal.aborted) {
    throw Error("Verify the conversation again.");
  }
  const result = await client.rpc("mark_hoopchat_read", { p_request_id: threadId, p_message_id: messageId })
    .setHeader("Authorization", session.bearer).abortSignal(session.signal);
  if (result.error || session.signal.aborted || result.data !== true) {
    throw Error("Read marker could not be synchronized.");
  }
}
