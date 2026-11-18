import type { SupabaseClient } from "@supabase/supabase-js";
import { assuranceForVerifiedUser } from "../auth/mfa-core";

/** Verify the exact request credential before inspecting assurance or factors. */
export async function requestMfaState(client: SupabaseClient, token: string) {
  const result = await client.auth.getUser(token);
  if (result.error || !result.data.user) throw new Error("Session verification failed");
  return assuranceForVerifiedUser(token, result.data.user);
}
