import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STRIPE_PORTAL_URL =
  "https://api.stripe.com/v1/billing_portal/sessions";

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

export async function POST(request: Request) {
  try {
    const stripeSecretKey =
      process.env.STRIPE_SECRET_KEY;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://hoopcheck-hktk6gt22-hoopcheck.vercel.app";

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured.",
        },
        { status: 500 }
      );
    }

    const authorization =
      request.headers.get("authorization");

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
    } = await supabase.auth.getUser(
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

    const { data: subscription, error } =
      await supabase
        .from("subscriptions")
        .select(
          "stripe_customer_id, status"
        )
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
      console.error(
        "Subscription lookup error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to find your subscription.",
        },
        { status: 500 }
      );
    }

    if (
      !subscription?.stripe_customer_id
    ) {
      return NextResponse.json(
        {
          error:
            "No Stripe subscription was found for this account.",
        },
        { status: 404 }
      );
    }

    const params =
      new URLSearchParams();

    params.append(
      "customer",
      subscription.stripe_customer_id
    );

    params.append(
      "return_url",
      `${siteUrl}/membership`
    );

    const response =
      await fetch(
        STRIPE_PORTAL_URL,
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
        "Stripe Customer Portal error:",
        data
      );

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Unable to open billing portal.",
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
      "Customer portal error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
