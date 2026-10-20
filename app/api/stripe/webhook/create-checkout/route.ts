import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server configuration."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(
  request: Request
) {
  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY;

  const siteUrl =
    process.env.VERCEL_ENV === "production"
      ? "https://hoopcheck.online"
      : process.env.NEXT_PUBLIC_SITE_URL;

  // Fail closed until the deployment explicitly declares and enables the
  // matching Stripe mode. Production must use live keys; non-production must
  // use test keys. This prevents accidental real charges from mixed config.
  const deploymentMode =
    process.env.VERCEL_ENV === "production" ? "live" : "test";
  const configuredMode = process.env.STRIPE_CHECKOUT_MODE;
  // Stripe restricted API keys (rk_live_/rk_test_) are valid server-side
  // credentials too. Accept either key type, but never mix live and test modes.
  const allowedKeyPrefixes =
    deploymentMode === "live"
      ? ["sk_live_", "rk_live_"]
      : ["sk_test_", "rk_test_"];

  const checkoutEnabled = process.env.STRIPE_CHECKOUT_ENABLED === "true";
  const keyPrefixValid = Boolean(
    stripeSecretKey &&
      allowedKeyPrefixes.some((prefix) => stripeSecretKey.startsWith(prefix))
  );

  if (!checkoutEnabled || configuredMode !== deploymentMode || !keyPrefixValid) {
    // Log only non-secret configuration booleans/modes; never log key material.
    console.warn("Stripe checkout configuration guard failed", {
      checkoutEnabled,
      configuredMode: configuredMode ?? null,
      deploymentMode,
      hasSecretKey: Boolean(stripeSecretKey),
      keyPrefixValid,
    });
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable while payment configuration is verified." },
      { status: 503 }
    );
  }

  if (
    !stripeSecretKey ||
    !siteUrl
  ) {
    return NextResponse.json(
      {
        error:
          "Stripe checkout is not configured.",
      },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    const authorization =
      request.headers.get(
        "authorization"
      );

    const accessToken =
      authorization?.replace(
        "Bearer ",
        ""
      );

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "You must be logged in.",
        },
        { status: 401 }
      );
    }

    const supabase =
      getAdminSupabase();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser(
        accessToken
      );

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Your session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > 8_192) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }

    let body: { plan?: string; interval?: string } = {};
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > 8_192) {
        return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
      }
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
      }
      body = parsed as { plan?: string; interval?: string };
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const plan = body.plan;
    const interval = body.interval || "month";
    if (!["month","6_month","year"].includes(interval)) return NextResponse.json({error:"Invalid billing interval."},{status:400});

    if (
      plan !== "pro" &&
      plan !== "premium"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid subscription plan.",
        },
        { status: 400 }
      );
    }

    const {
      data: existingSubscription,
      error: subscriptionError,
    } =
      await supabase
        .from("subscriptions")
        .select(
          "stripe_customer_id, stripe_subscription_id, status, plan"
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (subscriptionError) {
      console.error(
        "Subscription lookup error:",
        subscriptionError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check your current subscription.",
        },
        { status: 500 }
      );
    }

    // Only block checkout when the active membership is linked to a real
    // Stripe subscription. Complimentary/admin-granted memberships may be
    // active locally without billing and should still be able to subscribe.
    if (
      existingSubscription?.stripe_subscription_id &&
      (
        existingSubscription.status === "active" ||
        existingSubscription.status === "trialing"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You already have an active HoopCheck subscription.",
        },
        { status: 409 }
      );
    }

    const intervalKey = interval === "month" ? "monthly" : interval === "6_month" ? "6_month" : "year";
    const amountKey = plan === "pro"
      ? (interval === "month" ? "499" : interval === "6_month" ? "2545" : "5389")
      : (interval === "month" ? "999" : interval === "6_month" ? "5095" : "10789");
    const lookupKey = `hoopcheck_${plan}_${intervalKey}_${amountKey}_2026`;
    const priceList = await stripe.prices.list({lookup_keys:[lookupKey],active:true,limit:1});
    const priceId = priceList.data[0]?.id;
    if (!priceId) return NextResponse.json({error:"This membership term is not configured yet."},{status:500});

    const customerId =
      existingSubscription?.stripe_customer_id ||
      undefined;

    const session =
      await stripe.checkout.sessions.create(
        {
          mode: "subscription",

          // Show Stripe’s built-in promotion-code entry on hosted Checkout.
          allow_promotion_codes: true,

          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],

          success_url:
            `${siteUrl}/membership?success=true&session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${siteUrl}/membership?canceled=true`,

          client_reference_id:
            user.id,

          customer:
            customerId,

          customer_email:
            customerId
              ? undefined
              : user.email || undefined,

          metadata: {
            user_id: user.id,
            plan,
            billing_interval: interval,
          },

          subscription_data: {
            metadata: {
              user_id: user.id,
              plan,
              billing_interval: interval,
            },
          },

          integration_identifier:
            "hoopcheck_sub_AzQmLpRt",
        }
      );

    if (!session.url) {
      return NextResponse.json(
        {
          error:
            "Stripe did not return a checkout URL.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error(
      "Stripe Checkout error:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to create checkout session.",
      },
      { status: 500 }
    );
  }
}
