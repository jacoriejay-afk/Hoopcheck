import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function json(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.match(/^Bearer\\s+(\\S+)$/i)?.[1];
    if (!token) return json("Sign in to share a post.", 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !serviceKey || !publicKey) return json("Sharing is unavailable.", 503);
    if (Number(request.headers.get("content-length") || 0) > 1024) return json("Request too large.", 413);
    const raw = await request.text();
    if (raw.length > 1024) return json("Request too large.", 413);
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return json("Invalid request.", 400); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json("Invalid request.", 400);
    const { post_id: postId, recipient_id: recipientId } = payload as Record<string, unknown>;
    if (typeof postId !== "string" || !UUID.test(postId) || typeof recipientId !== "string" || !UUID.test(recipientId)) {
      return json("Invalid post or recipient.", 400);
    }

    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: identity, error: identityError } = await db.auth.getUser(token);
    const sender = identity.user?.id;
    if (identityError || !sender) return json("Session expired.", 401);
    if (sender === recipientId) return json("Choose another member.", 400);

    // Authorize post visibility with the sender's actual JWT, not service role.
    const viewer = createClient(url, publicKey, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: visible, error: visibilityError } = await viewer.from("feed_posts")
      .select("id,author_id").eq("id", postId).eq("status", "approved")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).maybeSingle();
    if (visibilityError || !visible) return json("Post unavailable.", 404);

    const { data: recipient } = await db.from("profiles").select("id,account_type").eq("id", recipientId).maybeSingle();
    if (!recipient || !["player", "fan"].includes(recipient.account_type)) return json("Recipient unavailable.", 404);

    // Restrict delivery to a real follow connection. Recipient must also follow
    // the post author (or be that author) so a sender cannot leak private posts.
    const { data: follow, error: followError } = await db.from("follow_relationships")
      .select("id").eq("follower_id", sender).eq("target_id", recipientId)
      .eq("target_type", recipient.account_type).limit(1);
    if (followError || !follow?.length) return json("Share only with people you follow.", 403);
    if (recipientId !== visible.author_id) {
      const { data: author } = await db.from("profiles").select("account_type").eq("id", visible.author_id).maybeSingle();
      const { data: access, error: accessError } = await db.from("follow_relationships")
        .select("id").eq("follower_id", recipientId).eq("target_id", visible.author_id)
        .eq("target_type", author?.account_type || "").limit(1);
      if (accessError || !access?.length) return json("This recipient cannot view that post.", 403);
    }

    const { data: blocks, error: blockError } = await db.from("user_blocks")
      .select("blocker_id").or(`and(blocker_id.eq.${sender},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${sender})`).limit(1);
    if (blockError || blocks?.length) return json("Sharing with this member is unavailable.", 403);

    const { count, error: rateError } = await db.from("hoopfeed_post_shares")
      .select("id", { count: "exact", head: true }).eq("sender_id", sender)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if (rateError) return json("Sharing is temporarily unavailable.", 503);
    if ((count || 0) >= 5) return json("Too many shares. Try again in a minute.", 429);

    const { error: insertError } = await db.from("hoopfeed_post_shares")
      .insert({ post_id: postId, sender_id: sender, recipient_id: recipientId });
    if (insertError && insertError.code !== "23505") return json("Couldn't send this share.", 500);
    return NextResponse.json({ ok: true });
  } catch {
    return json("Sharing is temporarily unavailable.", 503);
  }
}
