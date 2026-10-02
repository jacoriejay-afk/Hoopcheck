import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const stripe = new Stripe(stripeSecretKey);

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey
);

function getSubscriptionPeriodEnd(
  subscription: Stripe.Subscription
): Date | null {
  const periodEnd = subscription.items.data[0]?.current_period_end;

  return periodEnd
    ? new Date(periodEnd * 1000)
    : null;
}

function getInvoiceSubscriptionId(
  invoice: Stripe.Invoice
): string | null {
  const subscriptionDetails =
    invoice.parent?.subscription_details;

  const subscription =
    subscriptionDetails?.subscription;

  if (!subscription) {
    return null;
  }

  if (typeof subscription === "string") {
    return subscription;
  }

  return subscription.id;
}

async function saveSubscription(
  subscription: Stripe.Subscription
) {
  const userId =
    subscription.metadata?.user_id;

  const plan =
    subscription.metadata?.plan;

  if (!userId) {
    throw new Error(
      `Missing user_id metadata on subscription ${subscription.id}`
    );
  }

  if (
    plan !== "pro" &&
    plan !== "premium"
  ) {
    throw new Error(
      `Invalid plan metadata on subscription ${subscription.id}`
    );
  }

  const currentPeriodEnd =
    getSubscriptionPeriodEnd(subscription);

  const priceId =
    subscription.items.data[0]?.price?.id ?? null;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const { error } =
    await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          plan,
          status: subscription.status,
          current_period_end:
            currentPeriodEnd?.toISOString() ?? null,
          cancel_at_period_end:
            subscription.cancel_at_period_end,
        },
        {
          onConflict: "user_id",
        }
      );

  if (error) {
    throw error;
  }
}

async function markSubscriptionCanceled(
  subscriptionId: string
) {
  const { error } =
    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "canceled",
      })
      .eq(
        "stripe_subscription_id",
        subscriptionId
      );

  if (error) {
    throw error;
  }
}

export async function POST(
  request: Request
) {
  const rawBody = await request.text();

  const signature =
    request.headers.get("stripe-signature");

  const secret =
    process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return NextResponse.json(
      {
        error:
          "Missing Stripe signature",
      },
      {
        status: 400,
      }
    );
  }

  if (!secret) {
    console.error(
      "Missing STRIPE_WEBHOOK_SECRET"
    );

    return NextResponse.json(
      {
        error:
          "Stripe webhook is not configured",
      },
      {
        status: 500,
      }
    );
  }

  let event: Stripe.Event;

  try {
    event =
      stripe.webhooks.constructEvent(
        rawBody,
        signature,
        secret
      );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Invalid Stripe signature",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const { error: eventInsertError } =
      await supabaseAdmin
        .from("subscription_events")
        .insert({
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event,
        });

    if (eventInsertError) {
      if (
        eventInsertError.code === "23505"
      ) {
        return NextResponse.json({
          received: true,
          duplicate: true,
        });
      }

      throw eventInsertError;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        if (
          session.mode === "subscription" &&
          session.subscription
        ) {
          const subscriptionId =
            typeof session.subscription ===
            "string"
              ? session.subscription
              : session.subscription.id;

          const subscription =
            await stripe.subscriptions.retrieve(
              subscriptionId
            );

          await saveSubscription(
            subscription
          );
        }

        break;
      }

      case "invoice.paid": {
        const invoice =
          event.data.object as Stripe.Invoice;

        const subscriptionId =
          getInvoiceSubscriptionId(
            invoice
          );

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(
              subscriptionId
            );

          await saveSubscription(
            subscription
          );
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice =
          event.data.object as Stripe.Invoice;

        const subscriptionId =
          getInvoiceSubscriptionId(
            invoice
          );

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(
              subscriptionId
            );

          await saveSubscription(
            subscription
          );
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription =
          event.data.object as Stripe.Subscription;

        await saveSubscription(
          subscription
        );

        break;
      }

      case "customer.subscription.deleted": {
        const subscription =
          event.data.object as Stripe.Subscription;

        await markSubscriptionCanceled(
          subscription.id
        );

        break;
      }

      default:
        break;
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Stripe webhook processing failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing failed",
      },
      {
        status: 500,
      }
    );
  }
}
