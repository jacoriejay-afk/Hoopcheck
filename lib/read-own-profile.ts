import { supabase } from "./supabase";

/**
 * Backwards-compatible, owner-only profile reader for the privacy rollout.
 * Until the restricted profile boundary is installed, use the existing
 * authenticated RLS read. If SELECT is denied by the new column grants,
 * retry through the server-side owner/MFA projection, never by widening grants.
 * The RPC must verify auth.uid(); this client also checks the returned id.
 */
export async function readOwnProfile<T = Record<string, unknown>>(userId: string, columns: string) {
  const legacy = await supabase.from("profiles").select(columns).eq("id", userId).maybeSingle();
  if (!legacy.error || legacy.error.code !== "42501") {
    return { data: legacy.data as T | null, error: legacy.error };
  }

  const projected = await supabase.rpc("get_own_profile");
  if (projected.error) return { data: null as T | null, error: projected.error };
  const payload = projected.data;
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      (payload as Record<string, unknown>).id !== userId) {
    return { data: null as T | null, error: new Error("Your verified profile could not be loaded.") };
  }
  return { data: payload as T, error: null };
}
