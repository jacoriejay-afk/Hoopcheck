import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactMessage } from "./hoopChatHistory";

type OutgoingMessage = Omit<ContactMessage, "created_at">;

export function prepareConversationMessage(
  pending: Map<string, OutgoingMessage>,
  thread: string,
  viewer: string,
  body: string,
  createId: () => string,
  replyToId?: string,
) {
  const text = body.trim().slice(0, 2000);
  const previous = pending.get(thread);
  if (replyToId !== undefined && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(replyToId)) throw Error("Invalid reply target.");
  if (previous?.sender_id === viewer && previous.body === text && previous.reply_to_id === replyToId) return previous;
  const message = { id: createId(), request_id: thread, sender_id: viewer, body: text, ...(replyToId !== undefined ? {reply_to_id:replyToId} : {}) };
  pending.set(thread, message);
  return message;
}

export async function sendConversationMessage(
  client: SupabaseClient,
  message: OutgoingMessage,
  signal: AbortSignal,
  bearer: string,
) {
  if (signal.aborted) throw new Error("Delivery could not be confirmed.");
  const { error } = await client.from("player_contact_messages").insert(message)
    .setHeader("Authorization", bearer).abortSignal(signal);
  if (!error) return;
  if (error.code === "23505" && !signal.aborted) {
    // A previous attempt may have committed before the network dropped.
    // Keep the private body out of the request URL and confirm it locally.
    const existing = await client.from("player_contact_messages").select(message.reply_to_id ? "body,reply_to_id" : "body")
      .eq("id", message.id).eq("request_id", message.request_id).eq("sender_id", message.sender_id)
      .setHeader("Authorization", bearer).abortSignal(signal).maybeSingle();
    if (!existing.error && existing.data?.body === message.body && (!message.reply_to_id || existing.data.reply_to_id === message.reply_to_id)) return;
  }
  throw new Error("Delivery could not be confirmed. You can retry the same message.");
}
