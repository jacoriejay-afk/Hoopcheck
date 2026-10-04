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

function getPlanFromPrice(
  priceId: string | undefined
): "pro" | "premium" | null {
  const proPriceId =
    process.env.STRIPE_PRO_PRICE_ID;

  const premiumPriceId =
    process.env.STRIPE_PREMIUM_PRICE_ID;

  if (
    premiumPriceId &&
    priceId === premiumPriceId
  ) {
    return "premium";
  }

  if (
    proPriceId &&
    priceId === proPriceId
  ) {
    return "pro";
  }

  return null;
}

async function saveSubscription(
  userId: string,
  subscription: Stripe.Subscription
) {
  const supabase =
    getAdminSupabase();

  const priceId =
    subscription.items.data[0]?.price?.id;

  const plan =
    getPlanFromPrice(priceId);

  if (!plan) {
    throw new Error(
      `Unknown Stripe price: ${
        priceId || "missing"
      }`
    );
  }

  const currentPeriodEndTimestamp =
    subscription.items.data[0]?.current_period_end;
  const currentPeriodEnd =
    currentPeriodEndTimestamp
      ? new Date(
          currentPeriodEndTimestamp * 1000
        ).toISOString()
      : null;

  const { error } =
    await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id:
            typeof subscription.customer ===
            "string"
              ? subscription.customer
              : subscription.customer.id,
          stripe_subscription_id:
            subscription.id,
          stripe_price_id:
            priceId,
          plan,
          status:
            subscription.status,
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
  const supabase =
    getAdminSupabase();

  const { data, error } =
    await supabase
      .from("subscriptions")
      .select("user_id")
      .eq(
        "stripe_customer_id",
        customerId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find subscription owner: ${error.message}`
    );
  }

  return data?.user_id || null;
}

async function eventAlreadyProcessed(
  eventId: string
) {
  const supabase =
    getAdminSupabase();

  const { data, error } =
    await supabase
      .from("subscription_events")
      .select("stripe_event_id")
      .eq(
        "stripe_event_id",
        eventId
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to check Stripe event: ${error.message}`
    );
  }

  return Boolean(data);
}

async function saveEvent(
  event: Stripe.Event
) {
  const supabase =
    getAdminSupabase();

  const { error } =
    await supabase
      .from("subscription_events")
      .insert({
        stripe_event_id:
          event.id,
        event_type:
          event.type,
        payload:
          event,
      });

  if (!error) {
    return;
  }

  if (error.code === "23505") {
    return;
  }

  throw new Error(
    `Unable to save Stripe event: ${error.message}`
  );
}

async function getSubscriptionUserId(
  subscription: Stripe.Subscription
) {
  const metadataUserId =
    subscription.metadata?.user_id;

  if (metadataUserId) {
    return metadataUserId;
  }

  const customerId =
    typeof subscription.customer ===
    "string"
      ? subscription.customer
      : subscription.customer.id;

  return findUserByStripeCustomer(
    customerId
  );
}

function getInvoiceSubscriptionId(
  invoice: Stripe.Invoice
) {
  const subscription =
    invoice.parent?.subscription_details
      ?.subscription;

  if (!subscription) {
    return null;
  }

  return typeof subscription === "string"
    ? subscription
    : subscription.id;
}

export async function POST(
  request: Request
) {
  const stripeSecretKey =
    process.env.STRIPE_SECRET_KEY;

  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error(
      "Stripe webhook is not configured."
    );

    return NextResponse.json(
      {
        error:
          "Stripe webhook is not configured.",
      },
      { status: 500 }
    );
  }

  const stripe = new Stripe({apiKey: stripeSecretKey});

  try {
    const rawBody =
      await request.text();

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

    let event: Stripe.Event;

    try {
      event =
        stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
    } catch (error) {
      console.error(
        "Stripe signature verification failed:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Invalid Stripe signature.",
        },
        { status: 400 }
      );
    }

    const alreadyProcessed =
      await eventAlreadyProcessed(
        event.id
      );

    if (alreadyProcessed) {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    if (
      event.type ===
      "checkout.session.completed"
    ) {
      const session =
        event.data.object as Stripe.Checkout.Session;

      const userId =
        session.client_reference_id ||
        session.metadata?.user_id;

      if (!userId) {
        throw new Error(
          "Checkout session is missing the HoopCheck user ID."
        );
      }

      const subscriptionId =
        typeof session.subscription ===
        "string"
          ? session.subscription
          : session.subscription?.id;

      if (!subscriptionId) {
        throw new Error(
          "Checkout session is missing the subscription ID."
        );
      }

      const subscription =
        await stripe.subscriptions.retrieve(
          subscriptionId
        );

      await saveSubscription(
        userId,
        subscription
      );
    }

    if (
      event.type ===
      "invoice.paid"
    ) {
      const invoice =
        event.data.object as Stripe.Invoice;

      const subscriptionId =
        getInvoiceSubscriptionId(invoice);

      if (subscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(
            subscriptionId
          );

        const userId =
          await getSubscriptionUserId(
            subscription
          );

        if (userId) {
          await saveSubscription(
            userId,
            subscription
          );
        }
      }
    }

    if (
      event.type ===
      "invoice.payment_failed"
    ) {
      const invoice =
        event.data.object as Stripe.Invoice;

      const subscriptionId =
        getInvoiceSubscriptionId(invoice);

      if (subscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(
            subscriptionId
          );

        const userId =
          await getSubscriptionUserId(
            subscription
          );

        if (userId) {
          await saveSubscription(
            userId,
            subscription
          );
        }
      }
    }

    if (
      event.type ===
      "customer.subscription.updated"
    ) {
      const subscription =
        event.data.object as Stripe.Subscription;

      const userId =
        await getSubscriptionUserId(
          subscription
        );

      if (userId) {
        await saveSubscription(
          userId,
          subscription
        );
      }
    }

    if (
      event.type ===
      "customer.subscription.deleted"
    ) {
      const subscription =
        event.data.object as Stripe.Subscription;

      const userId =
        await getSubscriptionUserId(
          subscription
        );

      if (userId) {
        await saveSubscription(
          userId,
          subscription
        );
      }
    }

    await saveEvent(event);

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
