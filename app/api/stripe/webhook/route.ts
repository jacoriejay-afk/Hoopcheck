import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

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

function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
) {
  const parts = signature
    .split(",")
    .reduce(
      (
        result: Record<string, string[]>,
        item
      ) => {
        const [key, value] = item.split("=");

        if (key && value) {
          if (!result[key]) {
            result[key] = [];
          }

          result[key].push(value);
        }

        return result;
      },
      {}
    );

  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const timestampNumber =
    Number(timestamp);

  if (!Number.isFinite(timestampNumber)) {
    return false;
  }

  const currentTime =
    Math.floor(Date.now() / 1000);

  const tolerance = 300;

  if (
    Math.abs(
      currentTime - timestampNumber
    ) > tolerance
  ) {
    return false;
  }

  const signedPayload =
    `${timestamp}.${payload}`;

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(signedPayload)
      .digest("hex");

  return signatures.some(
    (receivedSignature) => {
      try {
        const expectedBuffer =
          Buffer.from(
            expectedSignature,
            "utf8"
          );

        const receivedBuffer =
          Buffer.from(
            receivedSignature,
            "utf8"
          );

        if (
          expectedBuffer.length !==
          receivedBuffer.length
        ) {
          return false;
        }

        return crypto.timingSafeEqual(
          expectedBuffer,
          receivedBuffer
        );
      } catch {
        return false;
      }
    }
  );
}

function getPlanFromPrice(
  priceId: string | undefined
) {
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
        Authorization:
          `Bearer ${stripeSecretKey}`,
      },
      cache: "no-store",
    }
  );

  const data =
    await response.json();

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
  const supabase =
    getAdminSupabase();

  const priceId =
    subscription.items?.data?.[0]
      ?.price?.id;

  const plan =
    getPlanFromPrice(priceId);

  if (!plan) {
    throw new Error(
      `Unknown Stripe price: ${
        priceId || "missing"
      }`
    );
  }

  const currentPeriodEnd =
    subscription.current_period_end
      ? new Date(
          subscription.current_period_end *
            1000
        ).toISOString()
      : null;

  const { error } =
    await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          stripe_customer_id:
            subscription.customer,
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

async function saveEvent(
  event: {
    id: string;
    type: string;
    [key: string]: unknown;
  }
) {
  const supabase =
    getAdminSupabase();

  const {
    data: existingEvent,
  } = await supabase
    .from("subscription_events")
    .select("id")
    .eq(
      "stripe_event_id",
      event.id
    )
    .maybeSingle();

  if (existingEvent) {
    return false;
  }

  const { error } =
    await supabase
      .from("subscription_events")
      .insert({
        stripe_event_id:
          event.id,
        event_type:
          event.type,
        payload: event,
      });

  if (error) {
    throw new Error(
      `Unable to save Stripe event: ${error.message}`
    );
  }

  return true;
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

    const validSignature =
      verifyStripeSignature(
        rawBody,
        signature,
        webhookSecret
      );

    if (!validSignature) {
      return NextResponse.json(
        {
          error:
            "Invalid Stripe signature.",
        },
        { status: 400 }
      );
    }

    let event: any;

    try {
      event =
        JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid webhook payload.",
        },
        { status: 400 }
      );
    }

    if (!event.id || !event.type) {
      return NextResponse.json(
        {
          error:
            "Invalid Stripe event.",
        },
        { status: 400 }
      );
    }

    const isNewEvent =
      await saveEvent(event);

    if (!isNewEvent) {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    /*
     * Checkout completed
     */
    if (
      event.type ===
      "checkout.session.completed"
    ) {
      const session =
        event.data
          ?.object as StripeCheckoutSession;

      const userId =
        session.client_reference_id ||
        session.metadata?.user_id;

      if (!userId) {
        throw new Error(
          "Checkout session is missing the HoopCheck user ID."
        );
      }

      if (!session.subscription) {
        throw new Error(
          "Checkout session is missing the subscription ID."
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
     * Successful recurring payment
     */
    if (
      event.type ===
      "invoice.paid"
    ) {
      const invoice =
        event.data
          ?.object as StripeInvoice;

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
     * Failed recurring payment
     */
    if (
      event.type ===
      "invoice.payment_failed"
    ) {
      const invoice =
        event.data
          ?.object as StripeInvoice;

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
     * Subscription updated
     */
    if (
      event.type ===
      "customer.subscription.updated"
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

    /*
     * Subscription deleted
     */
    if (
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
