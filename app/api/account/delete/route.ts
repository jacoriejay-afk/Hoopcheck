import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const STORAGE_BUCKETS = [
  "profile-avatars",
  "feed-images",
  "player-verification-documents",
] as const;

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { user, error };
}

async function removeUserStorage(
  admin: { storage: any },
  userId: string
) {
  for (const bucket of STORAGE_BUCKETS) {
    const files: string[] = [];

    async function collectFiles(prefix: string): Promise<void> {
      const { data, error } = await admin.storage.from(bucket).list(prefix, {
        limit: 1000,
      });

      if (error) {
        throw new Error(`Unable to list ${bucket}: ${error.message}`);
      }

      for (const item of data ?? []) {
        if (!item.name) continue;
        const path = `${prefix}/${item.name}`;
        // Supabase Storage represents folders as entries without file metadata.
        if (item.id == null && item.metadata == null) {
          await collectFiles(path);
        } else {
          files.push(path);
        }
      }
    }

    await collectFiles(userId);

    // Storage remove APIs accept batches; keep each request comfortably bounded.
    for (let i = 0; i < files.length; i += 100) {
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(files.slice(i, i + 100));

      if (removeError) {
        throw new Error(
          `Unable to clean ${bucket}: ${removeError.message}`
        );
      }
    }
  }
}

export async function POST(request: Request) {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    );
  }

  let body: { confirmation?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Type DELETE to confirm account deletion." },
      { status: 400 }
    );
  }

  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm account deletion." },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Account deletion is not configured yet." },
      { status: 503 }
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: subscription, error: subscriptionError } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subscriptionError) {
    return NextResponse.json(
      { error: "Unable to verify your membership before deletion." },
      { status: 500 }
    );
  }

  if (
    subscription?.stripe_subscription_id &&
    !["canceled", "incomplete_expired"].includes(subscription.status ?? "")
  ) {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        {
          error:
            "Membership cancellation is temporarily unavailable. Your account was not deleted. Please contact support.",
        },
        { status: 503 }
      );
    }

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const current = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id
      );

      if (
        current.status !== "canceled" &&
        current.status !== "incomplete_expired"
      ) {
        await stripe.subscriptions.cancel(current.id);
      }
    } catch (stripeError) {
      console.error("Stripe cancellation during account deletion failed:", stripeError);
      return NextResponse.json(
        {
          error:
            "We could not cancel your active membership safely. Your account was not deleted. Please contact support.",
        },
        { status: 502 }
      );
    }
  }

  try {
    await removeUserStorage(admin, user.id);
  } catch (storageError) {
    console.error("Storage cleanup during account deletion failed:", storageError);
    return NextResponse.json(
      {
        error:
          "We could not finish removing your account files safely. Your account was not deleted. Please contact support.",
      },
      { status: 502 }
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
