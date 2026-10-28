import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Account-correlation tokens must never be cached by browsers or intermediaries.
function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    ...init,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Apple IAP account-token service is not configured.");
  }

  return { url, anonKey, serviceRoleKey };
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * Returns the stable appAccountToken bound to the currently authenticated
 * HoopCheck user. The client cannot choose the token or user ID.
 *
 * The migration that creates apple_iap_account_tokens must be applied before
 * this endpoint is enabled in an environment. The service-role client never
 * leaves this server module.
 */
export async function POST(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return jsonNoStore({ error: "Sign in to prepare Apple purchases." }, { status: 401 });
  }

  let config: ReturnType<typeof getSupabaseConfig>;
  try {
    config = getSupabaseConfig();
  } catch {
    return jsonNoStore({ error: "Apple purchases are not configured." }, { status: 503 });
  }

  const authClient = createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return jsonNoStore({ error: "Your sign-in session is invalid or expired." }, { status: 401 });
  }

  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const userId = authData.user.id;
    const existing = await admin
      .from("apple_iap_account_tokens")
      .select("app_account_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.error) {
      console.error("Apple IAP account-token lookup failed:", existing.error.message);
      return jsonNoStore({ error: "Apple purchases are temporarily unavailable." }, { status: 503 });
    }

    if (existing.data?.app_account_token) {
      return jsonNoStore({ appAccountToken: existing.data.app_account_token });
    }

    // Let PostgreSQL generate the UUID. Never accept a client-provided token.
    const inserted = await admin
      .from("apple_iap_account_tokens")
      .insert({ user_id: userId })
      .select("app_account_token")
      .single();

    if (!inserted.error && inserted.data?.app_account_token) {
      return jsonNoStore({ appAccountToken: inserted.data.app_account_token });
    }

    // Concurrent first requests can race on the user_id primary key. In that
    // case, read the winner's stable token instead of generating a new one.
    const raced = await admin
      .from("apple_iap_account_tokens")
      .select("app_account_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (!raced.error && raced.data?.app_account_token) {
      return jsonNoStore({ appAccountToken: raced.data.app_account_token });
    }

    console.error("Apple IAP account-token creation failed:", inserted.error?.message ?? raced.error?.message);
    return jsonNoStore({ error: "Apple purchases are temporarily unavailable." }, { status: 503 });
  } catch (error) {
    console.error("Apple IAP account-token request failed:", error);
    return jsonNoStore({ error: "Apple purchases are temporarily unavailable." }, { status: 503 });
  }
}
