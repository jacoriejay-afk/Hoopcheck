import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase server configuration.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!stripeSecretKey) return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
    if (!siteUrl) return NextResponse.json({ error: "Site URL is not configured." }, { status: 500 });

    const stripe = new Stripe(stripeSecretKey);

    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.replace(/^Bearer /, "");
    if (!accessToken) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const supabase = getAdminSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) return NextResponse.json({ error: "Your session is invalid or expired." }, { status: 401 });

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      console.error("Subscription lookup error:", subscriptionError);
      return NextResponse.json({ error: "Unable to find your subscription." }, { status: 500 });
    }

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer was found for this account." }, { status: 404 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${siteUrl}/membership`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Customer Portal error:", error);
    return NextResponse.json({ error: "Unable to open billing portal." }, { status: 500 });
  }
}