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

  const proPriceId =
    process.env.STRIPE_PRO_PRICE_ID;

  const premiumPriceId =
    process.env.STRIPE_PREMIUM_PRICE_ID;
  const proSixMonthPriceId = process.env.STRIPE_PRO_6_MONTH_PRICE_ID;
  const premiumSixMonthPriceId = process.env.STRIPE_PREMIUM_6_MONTH_PRICE_ID;
  const proYearPriceId = process.env.STRIPE_PRO_YEAR_PRICE_ID;
  const premiumYearPriceId = process.env.STRIPE_PREMIUM_YEAR_PRICE_ID;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL;

  if (
    !stripeSecretKey ||
    !proPriceId ||
    !premiumPriceId ||
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

    let body: {
      plan?: string;
      interval?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
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

    if (
      existingSubscription &&
      (
        existingSubscription.status ===
          "active" ||
        existingSubscription.status ===
          "trialing"
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

    const priceId = plan === "premium" ? (interval === "year" ? premiumYearPriceId : interval === "6_month" ? premiumSixMonthPriceId : premiumPriceId) : (interval === "year" ? proYearPriceId : interval === "6_month" ? proSixMonthPriceId : proPriceId);
    if (!priceId) return NextResponse.json({error:"This membership term is not configured yet."},{status:500});

    const customerId =
      existingSubscription?.stripe_customer_id ||
      undefined;

    const session =
      await stripe.checkout.sessions.create(
        {
          mode: "subscription",

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
