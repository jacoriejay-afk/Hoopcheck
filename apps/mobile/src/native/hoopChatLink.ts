import type { SupabaseClient } from "@supabase/supabase-js";

export function conversationLinkId(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export async function readLinkedConversation(
  client: SupabaseClient,
  id: string,
  owner: string,
  bearer: string,
  signal: AbortSignal,
) {
  if (!conversationLinkId(id) || !conversationLinkId(owner) || !/^Bearer \S+$/.test(bearer) || signal.aborted) return null;
  const result = await client.rpc("resolve_hoopchat_destination", { p_request_id: id })
    .setHeader("Authorization", bearer).abortSignal(signal).maybeSingle();
  const row = result.data as { id: string; requester_id: string; player_id: string; status: string; created_at: string } | null;
  if (signal.aborted || result.error || !row || row.id !== id || row.status !== "accepted" ||
    !conversationLinkId(row.requester_id) || !conversationLinkId(row.player_id) ||
    ![row.requester_id, row.player_id].includes(owner) || !Number.isFinite(Date.parse(row.created_at))) return null;
  return { ...row, message: null };
}
