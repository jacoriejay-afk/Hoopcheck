import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { assuranceForVerifiedUser } from "../../auth/mfa-core";
import { APPLE_PRODUCTS, appleProduct, canPurchaseAppleMembership } from "../../billing/apple-products";
import { appleServices, AppleBillingError, type AppleServices } from "./proofs";
export async function appleRequest(request: Request, requireConfirmedEmail=true) {
  const token=request.headers.get("authorization")?.match(/^Bearer ([^\s]{1,16384})$/i)?.[1];
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!token) throw new AppleBillingError("sign_in",401,"Sign in to manage membership.");
  if(!url || !key || !secret) throw new AppleBillingError("apple_configuration",503,"Membership verification is unavailable.");
  const scoped=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await scoped.auth.getUser(token);
  if(error || !data.user || (requireConfirmedEmail && !data.user.email_confirmed_at)) throw new AppleBillingError("sign_in",401,"Confirm your email and sign in again.");
  const assurance=assuranceForVerifiedUser(token,data.user);
  let role:string;try{role=JSON.parse(Buffer.from(token.split('.')[1],"base64url").toString()).role;}catch{throw new AppleBillingError("sign_in",401,"Sign in again.");}
  if(role!=="authenticated") throw new AppleBillingError("account_setup",403,"Finish setting up your HoopCheck account first.");
  if(assurance.required) throw new AppleBillingError("mfa_required",403,"Verify your authenticator to continue.");
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return{scoped,db,user:data.user};
}
export async function configuredApple(db:SupabaseClient,services:AppleServices) {
  const {data,error}=await db.from("apple_billing_config").select("enabled,environment").eq("singleton",true).maybeSingle();
  if(error || data?.enabled!==true || data.environment!==services.environment) throw new AppleBillingError("apple_configuration",503,"Apple membership is not available yet. Existing memberships are unchanged.");
}
export async function appleCatalog(scoped:SupabaseClient,db:SupabaseClient,user:string,services:AppleServices) {
  await configuredApple(db,services);
  const [profile,deletion,stripe,apple]=await Promise.all([
    scoped.from("profiles").select("account_type,moderation_status").eq("id",user).maybeSingle(),
    scoped.from("account_deletion_requests").select("status").eq("user_id",user).in("status",["pending","processing","failed"]).limit(1).maybeSingle(),
    scoped.from("subscriptions").select("plan,status,access_status,current_period_end,stripe_subscription_id,stripe_customer_id").eq("user_id",user).maybeSingle(),
    db.from("apple_memberships").select("original_transaction_id,status,current_period_end,verified_at").eq("user_id",user).eq("environment",services.environment).order("signed_at",{ascending:false}).limit(20),
  ]);
  if(profile.error || deletion.error || stripe.error || apple.error || !profile.data) throw new AppleBillingError("account_unverified",503,"Your account and membership could not be verified.");
  const role=profile.data.account_type;
  const activeStripe=!!stripe.data?.stripe_subscription_id && ["active","trialing","past_due","unpaid","incomplete","paused"].includes(stripe.data.status);
  const allowed=canPurchaseAppleMembership(role) && !["suspended","banned","removed"].includes(profile.data.moderation_status||"") && !deletion.data;
  return{owner:user,environment:services.environment,products:APPLE_PRODUCTS,canPurchase:allowed&&!activeStripe,
    reason:deletion.data?"Cancel your pending account deletion before purchasing membership.":!allowed?"Native membership purchases are unavailable for this account. Existing membership and restoration rules are unchanged.":activeStripe?"Manage your existing Stripe subscription before starting Apple billing.":null,
    stripe:stripe.data,apple:apple.data??[]};
}
type StripeHistoryClient=Pick<Stripe,"invoices"|"subscriptions">;
export async function stripeIntroHistory(subscription:{stripe_customer_id?:string|null;stripe_subscription_id?:string|null}|null,client?:StripeHistoryClient,before=Infinity):Promise<"clear"|"paid"|"trial_used"|"unknown"> {
  if(!subscription?.stripe_customer_id)return subscription?.stripe_subscription_id?"unknown":"clear";
  if(!/^cus_[A-Za-z0-9]+$/.test(subscription.stripe_customer_id))return "unknown";
  if(!client){const secret=process.env.STRIPE_SECRET_KEY;if(!secret)return "unknown";client=new Stripe(secret,{timeout:10000,maxNetworkRetries:0});}
  try{
    let after:string|undefined,complete=false;
    for(let page=0;page<10;page++){
      const invoices=await client.invoices.list({customer:subscription.stripe_customer_id,status:"paid",limit:100,...(after?{starting_after:after}:{})});
      for(const invoice of invoices.data){
        if(!Number.isSafeInteger(invoice.amount_paid)||invoice.amount_paid<0)return "unknown";
        if(invoice.amount_paid>0){
          if(!Number.isFinite(before))return "paid";
          const paidAt=invoice.status_transitions?.paid_at;
          if(!paidAt||!Number.isSafeInteger(paidAt))return "unknown";
          if(paidAt*1000<=before)return "paid";
        }
      }
      if(!invoices.has_more){complete=true;break;}after=invoices.data.at(-1)?.id;if(!after)return "unknown";
    }
    if(!complete)return "unknown";
    after=undefined;
    for(let page=0;page<10;page++){
      const subscriptions=await client.subscriptions.list({customer:subscription.stripe_customer_id,status:"all",limit:100,...(after?{starting_after:after}:{})});
      for(const value of subscriptions.data){
        if(value.trial_start===undefined || (value.trial_start!==null && (!Number.isSafeInteger(value.trial_start)||value.trial_start<=0)))return "unknown";
        if(value.trial_start && value.trial_start*1000<=before)return "trial_used";
      }
      if(!subscriptions.has_more)return "clear";after=subscriptions.data.at(-1)?.id;if(!after)return "unknown";
    }
  }catch{/* Unknown history cannot authorize an introductory offer. */}
  return "unknown";
}
export async function purchaseIntent(scoped:SupabaseClient,db:SupabaseClient,user:string,input:Record<string,unknown>,services:AppleServices=appleServices()) {
  const product=appleProduct(input.productId);if(!product)throw new AppleBillingError("apple_product",400,"Choose an available membership product.");
  const catalog=await appleCatalog(scoped,db,user,services);
  if(!catalog.canPurchase)throw new AppleBillingError("apple_purchase_unavailable",409,catalog.reason||"Purchasing is unavailable.");
  const budget=await db.rpc("apple_take_purchase_intent",{p_user:user});
  if(budget.error)throw new AppleBillingError("apple_intent_unverified",503,"Purchase preparation could not be confirmed. Try again later.");
  if(budget.data!==true)throw new AppleBillingError("apple_rate_limit",429,"Too many purchase attempts. Please wait before trying again.");
  const identity=await services.verifyApp(input.signedAppTransaction);
  await refreshAppleMemberships(db,user,services,true);
  // An existing Apple subscription is managed through Apple's subscription UI;
  // starting another source is never an automatic upgrade or double billing.
  const refreshed=await db.from("apple_memberships").select("status,current_period_end").eq("user_id",user).eq("environment",services.environment).limit(21);
  if(refreshed.error || (refreshed.data?.length??0)>20)throw new AppleBillingError("apple_refresh",503,"Apple memberships need verification.");
  for(const membership of refreshed.data??[]){
    if(["active","trialing"].includes(membership.status) && Date.parse(membership.current_period_end)>Date.now()) throw new AppleBillingError("apple_already_subscribed",409,"Manage your existing Apple membership to change plans.");
  }
  let allowIntroductoryOffer=false,introductorySignature:string|null=null;
  let trialEligibility:"eligible"|"ineligible"|"unverified"="ineligible";
  if(product.trialDays){
    const history=await stripeIntroHistory(catalog.stripe);
    const priorPaid=history!=="clear";
    const result=await db.rpc("apple_reserve_trial",{p_user:user,p_app_transaction:identity.id,p_prior_ineligible:priorPaid});
    if(result.error)throw new AppleBillingError("apple_trial_unverified",503,"Trial eligibility could not be verified. Try again later.");
    allowIntroductoryOffer=result.data===true && history==="clear";
    trialEligibility=history==="unknown"?"unverified":allowIntroductoryOffer?"eligible":"ineligible";
    introductorySignature=services.introductorySignature(product.id,allowIntroductoryOffer,identity.id);
  }
  return{owner:user,productId:product.id,environment:services.environment,appTransactionID:identity.id,allowIntroductoryOffer,introductorySignature,trialEligibility};
}
export async function synchronizeApple(db:SupabaseClient,user:string,signed:unknown,services:AppleServices=appleServices()) {
  await configuredApple(db,services);
  const observed=await services.verifyTransaction(signed,user);
  return persistAppleStatus(db,user,observed,services);
}
export async function persistAppleStatus(db:SupabaseClient,user:string,observed:Awaited<ReturnType<AppleServices["verifyTransaction"]>>,services:AppleServices) {
  const current=await services.currentStatus(observed.originalTransactionId,user);
  return saveAppleStatus(db,user,current,observed,services);
}
async function saveAppleStatus(db:SupabaseClient,user:string,current:Awaited<ReturnType<AppleServices["currentStatus"]>>,observed:Awaited<ReturnType<AppleServices["verifyTransaction"]>>,services:AppleServices) {
  if(current.offerDiscountType==="FREE_TRIAL" && current.status===1 && current.expiresDate>Date.now()){
    const history=await db.from("subscriptions").select("stripe_customer_id,stripe_subscription_id").eq("user_id",user).maybeSingle();
    if(history.error)throw new AppleBillingError("apple_trial_unverified",503,"Trial payment history could not be verified.");
    const eligibility=await stripeIntroHistory(history.data,undefined,current.purchaseDate);
    if(eligibility==="unknown")throw new AppleBillingError("apple_trial_unverified",503,"Trial history could not be verified. Retry or restore later; no membership change was confirmed.");
    if(eligibility!=="clear")throw new AppleBillingError("apple_trial_ineligible",403,"The trial is for first-time payers who have not used a trial. Manage your Apple subscription before further charges.");
  }
  const result=await db.rpc("apple_record_membership",{p_user:user,p_environment:services.environment,p_original:observed.originalTransactionId,p_current:current,p_observed:observed});
  if(result.error || result.data?.acknowledged!==true)throw new AppleBillingError("apple_sync_unconfirmed",503,"Membership synchronization could not be confirmed. Restore or retry your purchase.");
  return{acknowledged:true,transactionId:observed.transactionId,status:result.data.status};
}
export async function appleNotification(db:SupabaseClient,signed:string,services:AppleServices=appleServices()) {
  await configuredApple(db,services);
  const notification=await services.verifyNotification(signed);
  if(!/^[a-f0-9-]{36}$/i.test(notification.notificationUUID??""))throw new AppleBillingError("apple_notification",400,"Apple notification could not be verified.");
  // TEST and non-transaction notifications never create a membership source.
  if(notification.data?.signedTransactionInfo){
    const observed=await services.verifyTransaction(notification.data.signedTransactionInfo);
    const owner=observed.appAccountToken.toLowerCase();
    const {data:existing,error}=await db.from("apple_memberships").select("user_id").eq("environment",services.environment).eq("original_transaction_id",observed.originalTransactionId).maybeSingle();
    if(error)throw new AppleBillingError("apple_notification",503,"Apple notification could not be processed.");
    // An unknown owner must be resolved by an authenticated purchase/restore,
    // rather than creating an entitlement for a deleted or unconfirmed account.
    if(existing && existing.user_id!==owner)throw new AppleBillingError("apple_ownership",403,"Apple notification ownership conflict.");
    if(existing)await persistAppleStatus(db,owner,observed,services);
  }
  const noted=await db.rpc("apple_note_notification",{p_id:notification.notificationUUID,p_hash:createHash("sha256").update(signed).digest("hex")});
  if(noted.error)throw new AppleBillingError("apple_notification",503,"Apple notification could not be confirmed.");
  return{received:true};
}

export async function refreshAppleMemberships(db:SupabaseClient,user:string,services:AppleServices=appleServices(),force=false) {
  await configuredApple(db,services);
  const result=await db.from("apple_memberships").select("original_transaction_id,verified_at").eq("user_id",user).eq("environment",services.environment).order("signed_at",{ascending:false}).limit(21);
  if(result.error || (result.data?.length??0)>20)throw new AppleBillingError("apple_refresh",503,"Apple memberships need verification. Restore your purchases or contact support.");
  const pending=(result.data??[]).filter(row=>force || Date.parse(row.verified_at)<Date.now()-86400000);
  // Bound parallel Apple requests; a failed batch grants no optimistic access.
  for(let offset=0;offset<pending.length;offset+=3)await Promise.all(pending.slice(offset,offset+3).map(async row=>{
    const current=await services.currentStatus(row.original_transaction_id,user);
    await saveAppleStatus(db,user,current,current,services);
  }));
}
