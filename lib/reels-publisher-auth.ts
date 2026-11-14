import { createClient } from "@supabase/supabase-js";
import { getHoopCheckEntitlements } from "./membership-tier";

/**
 * Shared REELS-1 server authorization. Caller supplies a bearer token; never
 * trust userId, role, subscription or moderation state from request metadata.
 * RLS-scoped reads are performed using that caller's JWT.
 */
export async function authorizeReelPublisher(token: string): Promise<
  | { ok: true; userId: string; createdAt: string }
  | { ok: false; status: 401 | 403 | 503; error: string }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ok: false, status: 503, error: "Service unavailable" };
  const viewer = createClient(url, key, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: identity, error: authError } = await viewer.auth.getUser(token);
  if (authError || !identity.user) return { ok: false, status: 401, error: "Invalid session" };
  const userId = identity.user.id;
  const [{ data: profile, error: profileError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    viewer.from("profiles").select("account_type,moderation_status").eq("id", userId).maybeSingle(),
    viewer.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", userId).maybeSingle(),
  ]);
  if (profileError || subscriptionError)
    return { ok: false, status: 503, error: "Unable to verify membership" };
  if (!profile || profile.moderation_status === "suspended")
    return { ok: false, status: 403, error: "Account not eligible" };
  if (!getHoopCheckEntitlements({ accountType: profile.account_type, subscription }).canWriteHoopFeed)
    return { ok: false, status: 403, error: "Active HoopFeed membership required" };
  return { ok: true, userId, createdAt: identity.user.created_at };
}
