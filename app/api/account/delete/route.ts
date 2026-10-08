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
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const supabase = getAdminSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Your session is invalid or expired." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (body?.confirmation !== "DELETE") {
      return NextResponse.json({ error: 'Type "DELETE" to confirm permanent account deletion.' }, { status: 400 });
    }

    // Stop future billing before removing the account.
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id,status")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (subscription?.stripe_subscription_id && stripeSecret) {
      const stripe = new Stripe(stripeSecret);
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        if (stripeSubscription.status !== "canceled" && stripeSubscription.status !== "incomplete_expired") {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        }
      } catch (stripeError) {
        console.error("Unable to cancel Stripe subscription before deletion:", stripeError);
        return NextResponse.json(
          { error: "We could not safely stop your subscription billing. Your account has not been deleted. Please contact HoopCheck support." },
          { status: 502 }
        );
      }
    }

    // auth.users deletion triggers database ON DELETE CASCADE relationships.
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Supabase account deletion error:", deleteError);
      return NextResponse.json(
        { error: "We could not complete account deletion. Please contact HoopCheck support." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Your HoopCheck account has been permanently deleted." });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "We could not complete account deletion. Please contact HoopCheck support." },
      { status: 500 }
    );
  }
}
