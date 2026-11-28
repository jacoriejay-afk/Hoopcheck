import "server-only";
import type {SealedPurchase} from "./token-vault";
type Value=string|number|boolean|null;
type Query=(statement:string,parameters:readonly Value[])=>Promise<unknown>;
type Bound={owner:string;sessionId:string;accountId:string;productId:string;basePlanId:string;priceMicros:string;currency:string};
type Intent=Bound&{intentId:string;expiresAt:number};
type Claim={owner:string;fingerprint:string;productId:string;basePlanId:string};
type Job={subscription:string;messageId:string;fingerprint:string;leaseId:string};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
const args=(b:Bound)=>[b.owner,b.sessionId,b.accountId,b.productId,b.basePlanId,b.priceMicros,b.currency];
/** Private, disposable PG17 adapter. Only an explicitly injected fixture driver
 * is accepted; no default connection, hosted URL, network or provider writes.
 * Driver must execute parameterized SQL and return the single scalar value. */
export function createDisposablePlayAdapters(options:{scope:"disposable_pg17";enabled:()=>boolean;query:Query}){
 if(options.scope!=="disposable_pg17")throw Error("Disposable Play database required");
 const run=async(statement:string,parameters:readonly Value[]=[])=>{
  if(!options.enabled())throw Error("Disposable Play database unavailable");
  return options.query(statement,parameters);
 };
 return {
  async issue(b:Bound){
   const v=await run("select play_billing_candidate.issue_test_intent_bound($1::uuid,$2::uuid,$3,$4,$5,$6,$7)",args(b));
   if(v===null)return null;
   if(!record(v)||typeof v.intentId!=="string"||!uuid.test(v.intentId)||typeof v.expiresAt!=="number"||!Number.isSafeInteger(v.expiresAt))throw Error("Invalid intent receipt");
   return {intentId:v.intentId,expiresAt:v.expiresAt};
  },
  async consume(i:Intent){return await run("select play_billing_candidate.consume_test_intent_bound($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::bigint)",[i.intentId,...args(i),i.expiresAt])===true;},
  async claimBound(owner:string,accountId:string,product:{productId:string;basePlanId:string},sealed:SealedPurchase){
   const v=await run("select play_billing_candidate.claim_bound_test_purchase($1::uuid,$2,$3,$4,$5,$6)",[owner,accountId,sealed.fingerprint,sealed.envelope,product.productId,product.basePlanId]);
   if(v==="claimed"||v==="already_claimed"||v==="foreign_owner"||v==="catalog_conflict"||v==="retry")return v;
   throw Error("Invalid claim result");
  },
  async claimReplacement(owner:string,accountId:string,previous:string,product:{productId:string;basePlanId:string},sealed:SealedPurchase){
   const v=await run("select play_billing_candidate.claim_replacement_test_purchase($1::uuid,$2,$3,$4,$5,$6,$7)",[owner,accountId,previous,sealed.fingerprint,sealed.envelope,product.productId,product.basePlanId]);
   if(v==="claimed"||v==="already_claimed"||v==="foreign_owner"||v==="catalog_conflict"||v==="retry")return v;
   throw Error("Invalid replacement result");
  },
  async fulfillReplacement(c:Claim,g:number,state:string,expiry:string,previous:string){return await run("select play_billing_candidate.finish_replacement_test_purchase($1,$2::uuid,$3::bigint,$4,$5::timestamptz,$6)",[c.fingerprint,c.owner,g,state,expiry,previous])===true;},
  async fulfill(c:Claim,g:number,state:string,expiry:string){return await run("select play_billing_candidate.finish_and_fulfill_test_purchase($1,$2::uuid,$3::bigint,$4,$5::timestamptz)",[c.fingerprint,c.owner,g,state,expiry])===true;},
  async confirm(c:Claim,g:number,expiry:string){return await run("select play_billing_candidate.confirm_test_fulfillment($1,$2::uuid,$3::bigint,$4::timestamptz)",[c.fingerprint,c.owner,g,expiry])===true;},
  async ownerHeld(owner:string){return await run("select exists(select 1 from play_billing_candidate.owner_holds where owner_id=$1::uuid)",[owner])!==false;},
  async holdOwner(owner:string){return await run("select play_billing_candidate.hold_test_owner($1::uuid)",[owner])===true;},
  async enqueue(s:string,m:string,f:string){const v=await run("select play_billing_candidate.enqueue_test_notification($1,$2,$3)",[s,m,f]);if(v==="queued"||v==="duplicate"||v==="conflict")return v;throw Error("Invalid queue receipt");},
  async lease():Promise<Job|null>{
   const v=await run("select row_to_json(x) from play_billing_candidate.lease_test_notification() x");
   if(v===null)return null;
   if(!record(v)||typeof v.subscription!=="string"||typeof v.message_id!=="string"||typeof v.fingerprint!=="string"||!hex.test(v.fingerprint)||typeof v.lease_id!=="string"||!uuid.test(v.lease_id))throw Error("Invalid queue lease");
   return {subscription:v.subscription,messageId:v.message_id,fingerprint:v.fingerprint,leaseId:v.lease_id};
  },
  async lookup(f:string):Promise<Claim|null>{
   const v=await run("select row_to_json(x) from (select owner_id,product_id,base_plan_id,fingerprint from play_billing_candidate.purchase_claims where environment='test' and package_name='online.hoopcheck.app' and fingerprint=$1 and not exists(select 1 from play_billing_candidate.owner_holds h where h.owner_id=purchase_claims.owner_id)) x",[f]);
   if(v===null)return null;
   if(!record(v)||typeof v.owner_id!=="string"||!uuid.test(v.owner_id)||typeof v.product_id!=="string"||typeof v.base_plan_id!=="string"||v.fingerprint!==f)throw Error("Invalid ownership record");
   return {owner:v.owner_id,productId:v.product_id,basePlanId:v.base_plan_id,fingerprint:f};
  },
  async credential(c:Claim):Promise<SealedPurchase>{
   const v=await run("select row_to_json(x) from (select credential_version,credential_envelope,fingerprint from play_billing_candidate.purchase_claims where environment='test' and package_name='online.hoopcheck.app' and fingerprint=$1 and owner_id=$2::uuid and not exists(select 1 from play_billing_candidate.owner_holds h where h.owner_id=purchase_claims.owner_id)) x",[c.fingerprint,c.owner]);
   if(!record(v)||v.credential_version!==1||typeof v.credential_envelope!=="string"||v.fingerprint!==c.fingerprint)throw Error("Invalid credential record");
   return {version:1,envelope:v.credential_envelope,fingerprint:c.fingerprint};
  },
  async begin(c:Claim){const v=await run("select play_billing_candidate.begin_test_refresh($1,$2::uuid)",[c.fingerprint,c.owner]);return typeof v==="number"&&Number.isSafeInteger(v)&&v>0?v:null;},
  async complete(c:Claim,g:number,state:string,expiry:string|null){return await run("select play_billing_candidate.finish_test_reconciliation($1,$2::uuid,$3::bigint,$4,$5::timestamptz)",[c.fingerprint,c.owner,g,state,expiry])===true;},
  async finish(j:Job,success:boolean){return await run("select play_billing_candidate.finish_test_notification($1,$2,$3::uuid,$4)",[j.subscription,j.messageId,j.leaseId,success])===true;}
 };
}
