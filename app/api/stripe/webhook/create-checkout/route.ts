import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STRIPE_API_URL =
  "https://api.stripe.com/v1/checkout/sessions";

const PRO_PRICE_ID =
  process.env.STRIPE_PRO_PRICE_ID ||
  "price_1ULOQmPfOHVXLGd2w1Nlen2E";

const PREMIUM_PRICE_ID =
  process.env.STRIPE_PREMIUM_PRICE_ID ||
  "price_1ULleDPfOHVXLGd2Omn2dLXR";

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
  try {
    const stripeSecretKey =
      process.env.STRIPE_SECRET_KEY;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://hoopcheck.vercel.app";

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured.",
        },
        { status: 500 }
      );
    }

    const {
      data: {
        user,
      },
    } = await getAdminSupabase().auth.getUser(
      request.headers.get(
        "authorization"
      )?.replace("Bearer ", "") || ""
    );

    if (!user) {
      return NextResponse.json(
        {
          error:
            "You must be logged in.",
        },
        { status: 401 }
      );
    }

    let body: {
      plan?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const plan = body.plan;

    let priceId: string;
    let planName: "pro" | "premium";

    if (plan === "premium") {
      priceId = PREMIUM_PRICE_ID;
      planName = "premium";
    } else {
      priceId = PRO_PRICE_ID;
      planName = "pro";
    }

    const params =
      new URLSearchParams();

    params.append(
      "mode",
      "subscription"
    );

    params.append(
      "line_items[0][price]",
      priceId
    );

    params.append(
      "line_items[0][quantity]",
      "1"
    );

    params.append(
      "success_url",
      `${siteUrl}/membership?success=true&session_id={CHECKOUT_SESSION_ID}`
    );

    params.append(
      "cancel_url",
      `${siteUrl}/membership?canceled=true`
    );

    params.append(
      "client_reference_id",
      user.id
    );

    params.append(
      "metadata[user_id]",
      user.id
    );

    params.append(
      "metadata[plan]",
      planName
    );

    params.append(
      "customer_email",
      user.email || ""
    );

    const response =
      await fetch(
        STRIPE_API_URL,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${stripeSecretKey}`,
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Stripe Checkout error:",
        data
      );

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Unable to create checkout session.",
        },
        {
          status: response.status,
        }
      );
    }

    return NextResponse.json({
      url: data.url,
    });
  } catch (error) {
    console.error(
      "Checkout route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message CV
            : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
