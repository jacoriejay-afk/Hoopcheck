import type { SupabaseClient } from "@supabase/supabase-js";

/** Caller reads must use the same verified session that will access the workspace. */
export async function workspaceAccountIsActive(scoped: SupabaseClient, owner: string) {
  const [session, profile] = await Promise.all([
    scoped.rpc("confirm_active_account_session"),
    scoped.from("profiles").select("moderation_status").eq("id", owner).maybeSingle(),
  ]);
  return !session.error && session.data === true && !profile.error && Boolean(profile.data) &&
    !["suspended", "banned", "removed"].includes(profile.data?.moderation_status);
}
