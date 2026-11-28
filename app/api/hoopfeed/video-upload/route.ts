import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHoopCheckEntitlements } from "../../../../lib/membership-tier";
import { assuranceForVerifiedUser } from "../../../../lib/auth/mfa-core";
import { readJsonBody, RequestBodyError } from "../../../../lib/server/read-json-body";

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
  if (authError || !user?.email_confirmed_at) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  try {
    if (assuranceForVerifiedUser(token, user).required) return NextResponse.json({ error: "Verify your authenticator" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin.from("profiles").select("account_type,moderation_status").eq("id", user.id).maybeSingle();
  if (profileError || !profile || ["suspended", "banned", "removed"].includes(profile.moderation_status)) return NextResponse.json({ error: "Account profile unavailable" }, { status: 403 });
  const { data: subscription } = await admin.from("membership_entitlements").select("plan,status,access_status,current_period_end").eq("user_id", user.id).maybeSingle();
  const { data: adminRoles } = await admin.from("admin_roles").select("role").eq("user_id", user.id);
  const isAdmin = (adminRoles || []).some(row => String(row.role || "").toLowerCase() === "admin");
  const entitlements = getHoopCheckEntitlements({ accountType: profile.account_type, subscription, isAdmin });
  if (!entitlements.canWriteHoopFeed) return NextResponse.json({ error: "HoopFeed posting is unavailable" }, { status: 403 });

  let body: unknown;
  try { body = await readJsonBody(request, 1024); } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  const { content_type: type, size } = (body ?? {}) as Record<string, unknown>;
  if (typeof type !== "string" || !Object.hasOwn(EXT, type) || typeof size !== "number" ||
      !Number.isSafeInteger(size) || size < 1 || size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "Unsupported video or size" }, { status: 400 });
  }
  const path = user.id + "/" + crypto.randomUUID() + "." + EXT[type];
  // Check the same caller's live session immediately before issuing a privileged upload token.
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const scoped = createClient(url, publishableKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const active = await scoped.rpc("confirm_active_account_session");
  if (active.error || active.data !== true) return NextResponse.json({ error: "Account session unavailable" }, { status: 403 });
  const { data, error } = await admin.storage.from("hoopfeed-private-videos").createSignedUploadUrl(path);
  if (error || !data?.token) return NextResponse.json({ error: "Upload unavailable" }, { status: 503 });
  return NextResponse.json({ mode: "private", path, token: data.token, bucket: "hoopfeed-private-videos" }, { headers: { "Cache-Control": "no-store" } });
}
