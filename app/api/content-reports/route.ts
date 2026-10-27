import { NextResponse } from "next/server";
import { authenticateModerationRequest } from "../../../lib/server/review-moderation";
const TYPES = ["review", "hoopfeed_post", "fan_feed_post", "chat_message", "player_chat_message"] as const;
const REASONS = ["Spam or advertising", "Harassment or abusive content", "Hate or discrimination", "Sexual or violent content", "Threats or dangerous content", "Personal information", "False or misleading information", "Other"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  const auth = await authenticateModerationRequest(request);
  if (!auth.ok) return auth.response;
  const db = auth.supabase as any;
  let body: Record<string, unknown>;
  try { const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > 12_000) return NextResponse.json({ error: "Report is too large." }, { status: 413 }); body = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid report request." }, { status: 400 }); }
  const type = body.contentType;
  const id = typeof body.contentId === "string" ? body.contentId : "";
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (!TYPES.includes(type as typeof TYPES[number]) || !UUID.test(id)) return NextResponse.json({ error: "Choose valid content to report." }, { status: 400 });
  if (!REASONS.includes(reason as typeof REASONS[number])) return NextResponse.json({ error: "Choose a report reason." }, { status: 400 });
  const table = type === "review" ? "reviews" : type === "hoopfeed_post" ? "feed_posts" : type === "fan_feed_post" ? "fan_feed_posts" : type === "chat_message" ? "fan_live_chat_messages" : type === "player_chat_message" ? "player_contact_messages" : "";
  const ownerColumn = type === "chat_message" ? "user_id" : type === "player_chat_message" ? "sender_id" : table ? "author_id" : "";
  const contentColumn = table ? "body" : "";
  let ownerId: string | null = null;
  let snapshot = typeof body.contentSnapshot === "string" ? body.contentSnapshot.slice(0, 6000) : "";
  if (table) {
    const { data, error } = await db.from(table).select(`id,${ownerColumn},${contentColumn}`).eq("id", id).maybeSingle();
    if (error) { console.error("Report target lookup failed:", error); return NextResponse.json({ error: "Could not verify that content." }, { status: 500 }); }
    if (!data) return NextResponse.json({ error: "Content not found." }, { status: 404 });
    ownerId = typeof data[ownerColumn] === "string" ? data[ownerColumn] as string : null;
    snapshot = typeof data[contentColumn] === "string" ? (data[contentColumn] as string).slice(0, 6000) : snapshot;
  }
  if (ownerId === auth.user.id) return NextResponse.json({ error: "You cannot report your own content." }, { status: 400 });
  const { error } = await db.from("content_reports").insert({ content_type: type, content_id: id, reporter_id: auth.user.id, content_owner_id: ownerId, content_snapshot: snapshot, reason, status: "open" });
  if (error?.code === "23505") return NextResponse.json({ error: "You have already reported this content." }, { status: 409 });
  if (error) { console.error("Content report insert failed:", error); return NextResponse.json({ error: "We couldn't submit the report." }, { status: 500 }); }
  return NextResponse.json({ ok: true }, { status: 201 });
}
