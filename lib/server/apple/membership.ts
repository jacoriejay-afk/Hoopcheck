import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EffectiveMembership } from "../../billing/membership";
import { appleServices,AppleBillingError } from "./proofs";
import { refreshAppleMemberships } from "./service";
export async function readEffectiveMembership(scoped:SupabaseClient,db:SupabaseClient,user:string) {
  const config=await db.from("apple_billing_config").select("enabled,environment").eq("singleton",true).maybeSingle();
  if(config.error || !config.data)throw new AppleBillingError("membership_unverified",503,"Membership could not be verified. Try again later.");
  if(config.data.enabled && config.data.environment){
    const sources=await db.from("apple_memberships").select("verified_at").eq("user_id",user).eq("environment",config.data.environment).order("signed_at",{ascending:false}).limit(21);
    if(sources.error || (sources.data?.length??0)>20)throw new AppleBillingError("membership_unverified",503,"Membership could not be verified. Try again later.");
    if(sources.data?.some(source=>!Number.isFinite(Date.parse(source.verified_at)) || Date.parse(source.verified_at)<Date.now()-86400000))await refreshAppleMemberships(db,user,appleServices());
  }
  const membership=await scoped.from("membership_entitlements").select("plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,provider").eq("user_id",user).maybeSingle();
  if(membership.error)throw new AppleBillingError("membership_unverified",503,"Membership could not be verified. Try again later.");
  return membership.data as EffectiveMembership|null;
}
