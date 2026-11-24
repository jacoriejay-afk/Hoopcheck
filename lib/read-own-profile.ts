import { supabase } from "./supabase";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Backwards-compatible, owner-only profile reader for the privacy rollout.
 * Keep the exact authenticated JWT across the legacy RLS projection and
 * protected owner RPC fallback so account switching cannot redirect reads.
 * Only an actual SELECT permission denial permits trying the protected RPC;
 * a missing RPC, network error or unknown auth state must fail closed.
 */
export async function readOwnProfile<T = Record<string, unknown>>(userId: string, columns: string) {
  const fail = (message: string) => ({ data: null as T | null, error: new Error(message) });
  try {
    if (!uuid.test(userId)) return fail("Your profile owner could not be verified.");
    const initial = await supabase.auth.getSession();
    if (initial.error || initial.data.session?.user.id !== userId)
      return fail("Your account changed. Sign in again.");
    const token = initial.data.session.access_token;
    if (!token) return fail("Your account changed. Sign in again.");

    // Some existing callers request preferences without id. Add the owner ID
    // to the projection so the response can always be verified.
    const projection = columns.split(",").some(field => field.trim() === "id") ? columns : `id,${columns}`;
    const legacy = await supabase.from("profiles").select(projection).eq("id", userId)
      .setHeader("Authorization", `Bearer ${token}`).maybeSingle();
    const result = legacy.error?.code === "42501"
      ? await supabase.rpc("get_own_profile").setHeader("Authorization", `Bearer ${token}`)
      : legacy;

    // Never return the old account's row after a logout, token refresh,
    // or another user signing in while the server request was in flight.
    const current = await supabase.auth.getSession();
    if (current.error || current.data.session?.user.id !== userId ||
        current.data.session.access_token !== token)
      return fail("Your account changed. Refresh your profile.");

    if (result.error) return { data: null as T | null, error: result.error };
    if (result.data == null) return { data: null as T | null, error: null };
    if (typeof result.data !== "object" || Array.isArray(result.data) ||
        !("id" in result.data) || result.data.id !== userId)
      return fail("Your verified profile could not be loaded.");

    return { data: result.data as T, error: null };
  } catch {
    // Never return sensitive data or invoke a broader table read on errors.
    return fail("Your profile could not be loaded. Try again.");
  }
}
