import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactMessage } from "./hoopChatHistory";

type OutgoingMessage = Omit<ContactMessage, "created_at">;

export function prepareConversationMessage(
  pending: Map<string, OutgoingMessage>,
  thread: string,
  viewer: string,
  body: string,
  createId: () => string,
) {
  const text = body.trim().slice(0, 2000);
  const previous = pending.get(thread);
  if (previous?.sender_id === viewer && previous.body === text) return previous;
  const message = { id: createId(), request_id: thread, sender_id: viewer, body: text };
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
    const existing = await client.from("player_contact_messages").select("body")
      .eq("id", message.id).eq("request_id", message.request_id).eq("sender_id", message.sender_id)
      .setHeader("Authorization", bearer).abortSignal(signal).maybeSingle();
    if (!existing.error && existing.data?.body === message.body) return;
  }
  throw new Error("Delivery could not be confirmed. You can retry the same message.");
}
