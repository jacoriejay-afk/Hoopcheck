import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSubscriptionProduct } from "@/lib/subscription-products";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ eligible: false, reason: "authentication_required" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ eligible: false, reason: "configuration_unavailable" }, { status: 503 });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ eligible: false, reason: "authentication_required" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("account_type").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return NextResponse.json({ eligible: false, reason: "profile_unavailable" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const product = getSubscriptionProduct(profile.account_type, searchParams.get("tier"), searchParams.get("duration"));
  if (!product) return NextResponse.json({ eligible: false, reason: "product_unavailable" });
  if (product.trialDays !== 7) return NextResponse.json({ eligible: false, reason: "trial_not_offered_for_duration" });

  // Until the cross-platform trial marker migration is applied, fail closed.
  // Never infer first-time eligibility from the absence of a subscription row.
  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("trial_used, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (subscriptionError) return NextResponse.json({ eligible: false, reason: "trial_state_unavailable" }, { status: 503 });
  if (!subscription) return NextResponse.json({ eligible: false, reason: "trial_state_unavailable" }, { status: 503 });
  if (subscription.trial_used === true) return NextResponse.json({ eligible: false, reason: "trial_already_used" });
  if (subscription.trial_used !== false) return NextResponse.json({ eligible: false, reason: "trial_state_unavailable" }, { status: 503 });
  if (subscription.status === "active" || subscription.status === "trialing") {
    return NextResponse.json({ eligible: false, reason: "existing_membership" });
  }
  return NextResponse.json({ eligible: true, reason: "eligible" });
}
