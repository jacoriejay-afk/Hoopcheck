import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { uuidPattern } from "./identifiers";
import { createAuthClient } from "../server/supabase-auth";

export const referralCookie = "hoopcheck-ambassador-referral";


export function ambassadorDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getActiveReferral() {
  const token = (await cookies()).get(referralCookie)?.value;
  return token && uuidPattern.test(token) ? token : null;
}

export async function requireAmbassadorSession(route: string, ownerOnly = false) {
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(route)}`);
  const { data } = await auth.auth.getClaims();
  if (data?.claims.role !== "authenticated" || !user.email_confirmed_at) notFound();

  if (ownerOnly) {
    const { data: owner, error } = await auth.rpc("is_approved_claim_owner");
    if (error || owner !== true) notFound();
  }
  return user;
}
