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

    // Remove user-owned uploads before deleting auth.users. Storage objects are not
    // removed automatically by relational ON DELETE CASCADE rules.
    const buckets = ["profile-avatars", "feed-images", "player-verification-documents"];
    for (const bucket of buckets) {
      let offset = 0;
      while (true) {
        const { data: objects, error: listError } = await supabase.storage
          .from(bucket)
          .list(user.id, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });

        if (listError) {
          console.error(`Unable to inspect user files in ${bucket}:`, listError);
          return NextResponse.json(
            { error: "We could not safely remove your uploaded files. Your account has not been deleted. Please contact HoopCheck support." },
            { status: 502 }
          );
        }

        if (!objects?.length) break;

        const paths = objects
          .filter((object) => object.name)
          .map((object) => `${user.id}/${object.name}`);

        if (paths.length) {
          const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
          if (removeError) {
            console.error(`Unable to remove user files from ${bucket}:`, removeError);
            return NextResponse.json(
              { error: "We could not safely remove your uploaded files. Your account has not been deleted. Please contact HoopCheck support." },
              { status: 502 }
            );
          }
        }

        if (objects.length < 1000) break;
        offset += objects.length;
      }
    }

    // auth.users deletion triggers the remaining database ON DELETE CASCADE
    // relationships. Retained moderation/legal audit rows use SET NULL for actor IDs.
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
