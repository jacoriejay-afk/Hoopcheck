import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHoopCheckEntitlements } from "../../../../lib/membership-tier";

export const runtime = "nodejs";

const EXT: Record<string, string> = {
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: profile } = await admin.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Account profile unavailable" }, { status: 403 });
  const { data: subscription } = await admin.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", user.id).maybeSingle();
  const { data: adminRoles } = await admin.from("admin_roles").select("role").eq("user_id", user.id);
  const isAdmin = (adminRoles || []).some(row => String(row.role || "").toLowerCase() === "admin");
  const entitlements = getHoopCheckEntitlements({ accountType: profile.account_type, subscription, isAdmin });
  if (!entitlements.canWriteHoopFeed) return NextResponse.json({ error: "HoopFeed posting is unavailable" }, { status: 403 });

  let body: { content_type?: string; size?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const type = body.content_type || "";
  const size = body.size;
  if (!EXT[type] || !Number.isSafeInteger(size) || !size || size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "Unsupported video or size" }, { status: 400 });
  }
  const path = user.id + "/" + crypto.randomUUID() + "." + EXT[type];
  const { data, error } = await admin.storage.from("hoopfeed-private-videos").createSignedUploadUrl(path);
  if (error || !data?.token) return NextResponse.json({ error: "Upload unavailable" }, { status: 503 });
  return NextResponse.json({ mode: "private", path, token: data.token, bucket: "hoopfeed-private-videos" }, { headers: { "Cache-Control": "no-store" } });
}
