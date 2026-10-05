import "server-only";

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type ModerationDatabase = {
  public: {
    Tables: {
      admin_roles: {
        Row: { user_id: string; role: string };
        Insert: { user_id: string; role: string };
        Update: { user_id?: string; role?: string };
        Relationships: [];
      };
      reviews: {
        Row: { id: string; status: string | null };
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
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
  const tokenMatch = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!tokenMatch) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      ),
    };
  }

  const supabase: SupabaseClient<ModerationDatabase> = createClient<ModerationDatabase>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(tokenMatch[1]);

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your session is invalid or expired." },
        { status: 401 }
      ),
    };
  }

  return { ok: true, supabase, user };
}

export async function authorizeModeratorRequest(
  request: Request
): Promise<AuthenticatedRequest> {
  const authenticated = await authenticateModerationRequest(request);
  if (!authenticated.ok) return authenticated;

  const { data: adminRole, error } = await authenticated.supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", authenticated.user.id)
    .maybeSingle();

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

  const role =
    typeof adminRole?.role === "string"
      ? adminRole.role.trim().toLowerCase()
      : "";

  if (role !== "admin" && role !== "moderator") {
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
