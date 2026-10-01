import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const STRIPE_API_URL =
  "https://api.stripe.com/v1/checkout/sessions";

const PRO_PRICE_ID =
  process.env.STRIPE_PRO_PRICE_ID ||
  "price_1ULOQmPfOHVXLGd2w1Nlen2E";

export async function POST() {
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
            "Stripe is not configured. Missing STRIPE_SECRET_KEY.",
        },
        { status: 500 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    const params = new URLSearchParams();

    params.append("mode", "subscription");

    params.append(
      "line_items[0][price]",
      PRO_PRICE_ID
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
      "pro"
    );

    params.append(
      "customer_email",
      user.email || ""
    );

    const response = await fetch(
      STRIPE_API_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Stripe Checkout error:",
        data
      );

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Unable to create Stripe Checkout session.",
        },
        { status: response.status }
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
          "Something went wrong creating Checkout.",
      },
      { status: 500 }
    );
  }
}
