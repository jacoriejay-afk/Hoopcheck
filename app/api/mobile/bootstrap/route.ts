import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mobileWorkspaceAccess } from "../../../../lib/ambassador/mobile-access";
import { getHoopCheckEntitlements } from "../../../../lib/membership-tier";
export const dynamic = "force-dynamic";
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function GET(request: Request) {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") || "");
  if (!match || match[1].length > 16384) return reply({ error: "Authentication required." }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return reply({ error: "Account service is unavailable." }, 503);
  try {
    const scoped = createClient(url, key, { global: { headers: { Authorization: `Bearer ${match[1]}` } }, auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    const { data: auth, error: authError } = await scoped.auth.getUser(match[1]);
    if (authError || !auth.user) return reply({ error: "Session expired. Sign in again." }, 401);
    const [profile, subscription, role] = await Promise.all([
      scoped.from("profiles").select("account_type,display_name,player_verified").eq("id", auth.user.id).maybeSingle(),
      scoped.from("membership_entitlements").select("plan,status,access_status,current_period_end").eq("user_id", auth.user.id).maybeSingle(),
      scoped.rpc("get_current_user_admin_role"),
    ]);
    if (profile.error || subscription.error || role.error) return reply({ error: "Account access could not be verified." }, 503);
    if (!profile.data) return reply({ error: "Complete your account setup first." }, 409);
    const entitlements = getHoopCheckEntitlements({ accountType: profile.data.account_type, subscription: subscription.data, isAdmin: role.data === "admin", playerVerified: profile.data.player_verified === true });
    const workspaces = await mobileWorkspaceAccess(scoped, match[1], auth.user);
    return reply({ user: { id: auth.user.id, displayName: profile.data.display_name, accountType: profile.data.account_type }, entitlements, workspaces });
  } catch { return reply({ error: "Account access could not be verified." }, 503); }
}
