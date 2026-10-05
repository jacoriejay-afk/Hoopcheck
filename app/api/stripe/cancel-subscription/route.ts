import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server configuration.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });

    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const supabase = getAdminSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Your session is invalid or expired." }, { status: 401 });

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id,status,current_period_end,cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: "No active Stripe subscription was found." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const cancel = body?.action !== "resume";
    const stripe = new Stripe(secret);

    const updated = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: cancel,
    });

    await supabase.from("subscriptions").update({
      cancel_at_period_end: updated.cancel_at_period_end,
      current_period_end: new Date(updated.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      cancel_at_period_end: updated.cancel_at_period_end,
      current_period_end: new Date(updated.current_period_end * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Subscription cancellation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update your membership." }, { status: 500 });
  }
}
