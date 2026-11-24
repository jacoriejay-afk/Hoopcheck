import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { assuranceForVerifiedUser } from "../auth/mfa-core";

// Temporary production bridge. Replace with the reviewed unified membership
// reader BEFORE deploying Apple membership schema or enabling purchases.
// This is never a fallback on a failed unified membership query.
export function membershipReply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function legacyMobileRead(request: Request, kind: "membership" | "catalog") {
  const token = /^Bearer ([^\s]{1,16384})$/i.exec(request.headers.get("authorization") || "")?.[1];
  if (!token) return membershipReply({ error: "Sign in to verify membership." }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return membershipReply({ error: "Membership verification is unavailable." }, 503);
  try {
    const scoped = createClient(url, key, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await scoped.auth.getUser(token);
    if (error || !data.user) return membershipReply({ error: "Sign in again." }, 401);
    const claims = await scoped.auth.getClaims(token);
    if (claims.error || claims.data?.claims.role !== "authenticated" || data.user.is_anonymous === true ||
        assuranceForVerifiedUser(token, data.user).required) return membershipReply({ error: "Complete security verification first." }, 403);
    const owner = data.user.id;
    if (kind === "catalog") {
      if (!data.user.email_confirmed_at) return membershipReply({ error: "Confirm your email first." }, 403);
      // Deliberately disabled in this deployment. No purchase or restore acknowledgment.
      return membershipReply({ owner, environment: null, products: [], canPurchase: false,
        reason: "New Apple purchases are not available yet. Existing memberships are unchanged." });
    }
    const { data: row, error: readError } = await scoped.from("subscriptions")
      .select("plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,stripe_subscription_id")
      .eq("user_id", owner).maybeSingle();
    if (readError) return membershipReply({ error: "Membership could not be verified." }, 503);
    if (!row) return membershipReply({ owner, subscription: null });
    if (![null, "pro", "premium"].includes(row.plan) || typeof row.status !== "string" ||
        typeof row.access_status !== "string" || typeof row.cancel_at_period_end !== "boolean" ||
        !["month", "6_month", "year"].includes(row.billing_interval) ||
        !(row.current_period_end === null || typeof row.current_period_end === "string" && Number.isFinite(Date.parse(row.current_period_end))) ||
        !(row.stripe_subscription_id === null || typeof row.stripe_subscription_id === "string" && /^sub_[A-Za-z0-9]+$/.test(row.stripe_subscription_id)))
      return membershipReply({ error: "Membership could not be verified." }, 503);
    return membershipReply({ owner, subscription: {
      plan: row.plan, status: row.status, access_status: row.access_status,
      current_period_end: row.current_period_end, cancel_at_period_end: row.cancel_at_period_end,
      billing_interval: row.billing_interval, provider: row.stripe_subscription_id ? "stripe" : "manual"
    } });
  } catch { return membershipReply({ error: "Membership could not be verified." }, 503); }
}
