import "server-only";

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { assuranceForVerifiedUser } from "../auth/mfa-core";

type ModerationDatabase = {
  public: {
    Tables: {
      reviews: {
        Row: { id: string; status: string | null; team_id: string | null; author_id: string | null; is_anonymous: boolean | null };
        Insert: Record<string, unknown>;
        Update: { status?: string; updated_at?: string };
        Relationships: [];
      };
      review_reports: {
        Row: { id: string; status: string | null };
        Insert: {
          review_id: string;
          reporter_id: string;
          reason: string;
          status: string;
        };
        Update: { status?: string };
        Relationships: [];
      };
      review_moderation_events: {
        Row: {
          id: string;
          review_id: string | null;
          report_id: string | null;
          actor_id: string;
          entity_type: string;
          from_status: string | null;
          to_status: string;
          created_at: string;
        };
        Insert: {
          review_id?: string | null;
          report_id?: string | null;
          actor_id: string;
          entity_type: string;
          from_status?: string | null;
          to_status: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type AuthenticatedRequest =
  | {
      ok: true;
      supabase: SupabaseClient<ModerationDatabase>;
      scoped: SupabaseClient;
      user: User;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function authenticateModerationRequest(
  request: Request
): Promise<AuthenticatedRequest> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("Missing Supabase server configuration for moderation.");
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Moderation is not configured on the server." },
        { status: 500 }
      ),
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(\S{1,16384})$/i)?.[1];

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      ),
    };
  }

  const auth = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };
  const scoped = createClient(supabaseUrl, publishableKey, {
    auth,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  let user: User;
  try {
    const result = await scoped.auth.getUser(token);
    if (result.error || !result.data.user || !result.data.user.email_confirmed_at) {
      throw Error("Session verification failed.");
    }
    user = result.data.user;
    if (assuranceForVerifiedUser(token, user).required) {
      return { ok: false, response: NextResponse.json(
        { error: "Verify your authenticator to continue.", code: "mfa_required" },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      ) };
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your session is invalid or expired." },
        { status: 401 }
      ),
    };
  }

  // The signed caller must still own a live session. The same scoped client
  // enforces the database freeze and checks the account moderation status.
  try {
    const [active, profile] = await Promise.all([
      scoped.rpc("confirm_active_account_session"),
      scoped.from("profiles").select("moderation_status").eq("id", user.id).maybeSingle(),
    ]);
    if (!active.error && active.data === true && !profile.error && profile.data &&
        !["suspended", "banned", "removed"].includes(profile.data.moderation_status)) {
      const supabase = createClient<ModerationDatabase>(supabaseUrl, serviceRoleKey, { auth });
      return { ok: true, supabase, scoped, user };
    }
  } catch { /* Treat an unavailable authorization check as denial. */ }

  return { ok: false, response: NextResponse.json(
    { error: "Account access could not be verified." },
    { status: 403, headers: { "Cache-Control": "private, no-store" } },
  ) };
}

export async function authorizeModeratorRequest(
  request: Request
): Promise<AuthenticatedRequest> {
  const authenticated = await authenticateModerationRequest(request);
  if (!authenticated.ok) return authenticated;

  const { data: permitted, error } = await authenticated.scoped.rpc("is_current_user_admin_or_moderator");

  if (error) {
    console.error("Unable to verify moderation role:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unable to verify moderation permissions." },
        { status: 500 }
      ),
    };
  }

  if (permitted !== true) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You are not authorized to moderate content." },
        { status: 403 }
      ),
    };
  }

  return authenticated;
}
