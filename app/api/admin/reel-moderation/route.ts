import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Standard UUID is 8-4-4-4-12. The previous pattern required an extra
// four-hex group and prevented legitimate moderators from acting on reports.
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };
const response = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

/** Staff-only write action. The client never receives service-role credentials.
 * Moderation state and its audit row are changed together by a SECURITY INVOKER
 * database function; approval/restoration is intentionally unsupported here.
 */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 4096) return response("Moderation request too large.", 413);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return response("Sign in to the moderator dashboard.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishable || !service) return response("Moderation unavailable.", 503);
  try {
    const publicClient = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await publicClient.auth.getUser(token);
    if (authError || !user) return response("Session expired.", 401);
    const { data: isModerator, error: roleError } = await publicClient.rpc("is_current_user_admin_or_moderator");
    if (roleError || isModerator !== true) return response("You are not authorized to moderate videos.", 403);

    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return response("Invalid request.", 400);
      payload = parsed as Record<string, unknown>;
    } catch { return response("Invalid request.", 400); }
    const postId = payload.postId;
    const ticketId = payload.ticketId ?? null;
    const reason = payload.reason;
    if (typeof postId !== "string" || !UUID.test(postId)
      || (ticketId !== null && (typeof ticketId !== "string" || !UUID.test(ticketId)))
      || typeof reason !== "string" || reason.trim().length < 25 || reason.trim().length > 1000)
      return response("Select a valid Reel and provide 25–1,000 characters of written moderation evidence.", 400);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: hidden, error: moderateError } = await admin.rpc("hide_approved_reel_for_moderation", {
      p_reel_id: postId, p_moderator_id: user.id, p_reason: reason.trim(), p_support_ticket_id: ticketId,
    });
    if (moderateError) {
      console.error("Staff Reel moderation failed", moderateError.code);
      return response("Video moderation failed. Confirm the ticket and try again.", 503);
    }
    if (!hidden) return response("This video is not currently an approved Reel, or it was already hidden.", 409);
    return NextResponse.json({ hidden: true, message: "Video removed from public HoopFeed and Reels. Audit recorded." }, { headers });
  } catch {
    return response("Moderation is temporarily unavailable.", 503);
  }
}
