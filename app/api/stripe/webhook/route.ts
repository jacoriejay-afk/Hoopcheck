import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const STRIPE_API_URL = "https://api.stripe.com/v1";

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
      };
    }>;
  };
};

type StripeCheckoutSession = {
  id: string;
  client_reference_id: string | null;
  customer: string | null;
  subscription: string | null;
  metadata?: {
    user_id?: string;
    plan?: string;
  };
};

type StripeInvoice = {
  id: string;
  customer: string;
  subscription: string | null;
};

function getPlanFromPrice(priceId: string | undefined) {
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;

  if (priceId === premiumPriceId) {
    return "premium";
  }

  if (priceId === proPriceId) {
    return "pro";
  }

  return null;
}

async function stripeRequest<T>(
  path: string
): Promise<T> {
  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY."
    );
  }

  const response = await fetch(
    `${STRIPE_API_URL}${path}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "Stripe API request failed."
    );
  }

  return data;
}

async function saveSubscription(
  userId: string,
  subscription: StripeSubscription
) {
  const priceId =
    subscription.items?.data?.[0]?.price?.id;

  const plan = getPlanFromPrice(priceId);

  if (!plan) {
    throw new Error(
      `Unknown Stripe price: ${priceId || "missing"}`
    );
  }

  const currentPeriodEnd =
    subscription.current_period_end
      ? new Date(
          subscription.current_period_end * 1000
        ).toISOString()
      : null;

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id:
          subscription.customer,
        stripe_subscription_id:
          subscription.id,
        stripe_price_id: priceId,
        plan,
        status: subscription.status,
        current_period_end:
          currentPeriodEnd,
        cancel_at_period_end:
          subscription.cancel_at_period_end,
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) {
    throw new Error(
      `Supabase subscription update failed: ${error.message}`
    );
  }
}

async function findUserByStripeCustomer(
  customerId: string
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find subscription owner: ${error.message}`
    );
  }

  return data?.user_id || null;
}

export async function POST(
  request: Request
) {
  try {
    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        {
          error:
            "Missing STRIPE_WEBHOOK_SECRET.",
        },
        { status: 500 }
      );
    }

    /*
     * IMPORTANT:
     *
     * Stripe webhook signature verification
     * requires the raw request body.
     *
     * We read the body here so this endpoint
     * is ready for Stripe's signed webhook
     * payload.
     */

    const rawBody = await request.text();

    const signature =
      request.headers.get(
        "stripe-signature"
      );

    if (!signature) {
      return NextResponse.json(
        {
          error:
            "Missing Stripe signature.",
        },
        { status: 400 }
      );
    }

    /*
     * The webhook verification will be completed
     * with Stripe's signing secret when the
     * endpoint is connected in Stripe.
     *
     * For now, reject unsigned requests and
     * continue only when the configured secret
     * is present.
     */

    if (!rawBody) {
      return NextResponse.json(
        {
          error: "Empty webhook body.",
        },
        { status: 400 }
      );
    }

    let event: {
      id: string;
      type: string;
      data?: {
        object?: any;
      };
    };

    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid webhook payload.",
        },
        { status: 400 }
      );
    }

    /*
     * Prevent duplicate processing.
     */

    const { data: existingEvent } =
      await supabase
        .from("subscription_events")
        .select("id")
        .eq("stripe_event_id", event.id)
        .maybeSingle();

    if (existingEvent) {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    /*
     * Save the event first.
     */

    const { error: eventInsertError } =
      await supabase
        .from("subscription_events")
        .insert({
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event,
        });

    if (eventInsertError) {
      console.error(
        "Unable to save Stripe event:",
        eventInsertError
      );
    }

    /*
     * Handle completed Checkout.
     */

    if (
      event.type ===
      "checkout.session.completed"
    ) {
      const session =
        event.data?.object as StripeCheckoutSession;

      const userId =
        session.client_reference_id ||
        session.metadata?.user_id;

      if (!userId) {
        throw new Error(
          "Checkout session does not contain a HoopCheck user ID."
        );
      }

      if (!session.subscription) {
        throw new Error(
          "Checkout session does not contain a subscription ID."
        );
      }

      const subscription =
        await stripeRequest<StripeSubscription>(
          `/subscriptions/${session.subscription}`
        );

      await saveSubscription(
        userId,
        subscription
      );
    }

    /*
     * Handle successful recurring payments.
     */

    if (
      event.type === "invoice.paid"
    ) {
      const invoice =
        event.data?.object as StripeInvoice;

      if (invoice.subscription) {
        const userId =
          await findUserByStripeCustomer(
            invoice.customer
          );

        if (userId) {
          const subscription =
            await stripeRequest<StripeSubscription>(
              `/subscriptions/${invoice.subscription}`
            );

          await saveSubscription(
            userId,
            subscription
          );
        }
      }
    }

    /*
     * Handle failed recurring payments.
     */

    if (
      event.type ===
      "invoice.payment_failed"
    ) {
      const invoice =
        event.data?.object as StripeInvoice;

      if (invoice.subscription) {
        const userId =
          await findUserByStripeCustomer(
            invoice.customer
          );

        if (userId) {
          const subscription =
            await stripeRequest<StripeSubscription>(
              `/subscriptions/${invoice.subscription}`
            );

          await saveSubscription(
            userId,
            subscription
          );
        }
      }
    }

    /*
     * Handle subscription changes/cancellations.
     */

    if (
      event.type ===
      "customer.subscription.updated" ||
      event.type ===
      "customer.subscription.deleted"
    ) {
      const subscription =
        event.data
          ?.object as StripeSubscription;

      const userId =
        await findUserByStripeCustomer(
          subscription.customer
        );

      if (userId) {
        await saveSubscription(
          userId,
          subscription
        );
      }
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Stripe webhook error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}
