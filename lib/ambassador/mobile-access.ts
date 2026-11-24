import type { SupabaseClient, User } from "@supabase/supabase-js";
import { assuranceForVerifiedUser } from "../auth/mfa-core";
import { getAmbassadorWorkspace } from "./server";

export type WorkspaceAccess = { owner: boolean; ambassador: boolean };
/** Caller must first verify the exact bearer with Auth.getUser(token). */
export async function mobileWorkspaceAccess(scoped: SupabaseClient, token: string, user: User): Promise<WorkspaceAccess> {
  const denied = { owner: false, ambassador: false };
  try {
    if (!user.email_confirmed_at) return denied;
    const claims = await scoped.auth.getClaims(token);
    if (claims.error || claims.data?.claims.role !== "authenticated" || assuranceForVerifiedUser(token, user).required) return denied;
    const [owner, ambassador] = await Promise.all([
      scoped.rpc("is_approved_claim_owner"),
      getAmbassadorWorkspace(user.id).catch(() => false),
    ]);
    return { owner: !owner.error && owner.data === true, ambassador: ambassador === true };
  } catch { return denied; }
}
