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

    let body: { plan?: string; interval?: string; promoCode?: string } = {};
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

    const { data: checkoutProfile, error: checkoutProfileError } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();

    if (checkoutProfileError || !checkoutProfile) {
      return NextResponse.json({ error: "Unable to verify your HoopCheck account type." }, { status: 403 });
    }

    if (["coach", "manager"].includes(checkoutProfile.account_type) && plan !== "premium") {
      return NextResponse.json({ error: "Coach and Team Manager accounts require HoopCheck Premium." }, { status: 403 });
    }

    const submittedPromoCode =
      typeof body.promoCode === "string" ? body.promoCode.trim() : "";
    if (submittedPromoCode && (submittedPromoCode.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(submittedPromoCode))) {
      return NextResponse.json({ error: "Enter a valid promo code." }, { status: 400 });
    }

    let promoCodeId: string | undefined;
    if (submittedPromoCode) {
      // First-month-free codes are intentionally limited to Player accounts
      // and the monthly Pro plan. Stripe remains the source of truth for
      // redemption limits and first-time-customer restrictions.
      if (plan !== "pro" || interval !== "month") {
        return NextResponse.json({ error: "This offer is only available for monthly Pro." }, { status: 400 });
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || profile?.account_type !== "player") {
        return NextResponse.json({ error: "This promo offer is only available to Player accounts." }, { status: 403 });
      }

      const matchingCodes = await stripe.promotionCodes.list({
        code: submittedPromoCode,
        active: true,
        limit: 2,
      });
      const matchingCode = matchingCodes.data.find(
        (candidate) => candidate.active && candidate.code.toLowerCase() === submittedPromoCode.toLowerCase()
      );

      if (!matchingCode) {
        return NextResponse.json({ error: "That promo code is invalid, expired, or fully redeemed." }, { status: 400 });
      }

      const promotion = matchingCode as unknown as {
        id: string;
        restrictions?: { first_time_transaction?: boolean };
        promotion?: { type?: string; coupon?: string | { id: string; duration?: string; percent_off?: number | null; amount_off?: number | null } };
      };
      const couponRef = promotion.promotion?.coupon;
      const coupon = typeof couponRef === "string"
        ? await stripe.coupons.retrieve(couponRef)
        : couponRef;

      if (
        !coupon ||
        coupon.duration !== "once" ||
        coupon.percent_off !== 100 ||
        coupon.amount_off != null
      ) {
        return NextResponse.json({ error: "This code is not configured for a one-month-free offer." }, { status: 400 });
      }

      if (!promotion.restrictions?.first_time_transaction) {
        return NextResponse.json({ error: "This offer must be configured for first-time customers." }, { status: 400 });
      }

      promoCodeId = matchingCode.id;
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
          allow_promotion_codes: !promoCodeId,

          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],

          ...(promoCodeId ? { discounts: [{ promotion_code: promoCodeId }] } : {}),

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
