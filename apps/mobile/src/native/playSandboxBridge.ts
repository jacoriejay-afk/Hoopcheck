import {createPlayPurchaseCoordinator} from "./playPurchaseCoordinator";
import type {createPlayRecoveryJournal} from "./playRecoveryJournal";
type CoordinatorPorts=Parameters<typeof createPlayPurchaseCoordinator>[0];
type Quote=Parameters<CoordinatorPorts["prepare"]>[0];
type Intent=Parameters<CoordinatorPorts["launch"]>[0];
type Transport=(action:"identity"|"issue"|"consume"|"sync",token:string,body?:Record<string,unknown>)=>Promise<unknown>;
/** Explicitly synthetic adapter. No default HTTP, real BillingClient launch,
 * or membership mutation. A future signed sandbox bridge must separately
 * enforce its storefront/license-test release gate. */
export function createPlaySandboxBridge(p:{
 scope:"synthetic"|"signed_sandbox";enabled():boolean;available():boolean;session:CoordinatorPorts["session"];
 request:Transport;native:{launch(intent:Intent):Promise<unknown>;restore(accountId:string):Promise<unknown>};
 journal:ReturnType<typeof createPlayRecoveryJournal>;now():number;
}){
 if(p.scope!=="synthetic"&&p.scope!=="signed_sandbox")throw Error("Sandbox billing required");
 const quote=(v:Quote)=>({productId:v.productId,basePlanId:v.basePlanId,priceMicros:v.priceMicros,currency:v.currency});
 return createPlayPurchaseCoordinator({
  enabled:p.enabled,available:p.available,session:p.session,journal:p.journal,now:p.now,
  prepare:(q,t)=>p.request("issue",t,quote(q)),
  consume:(i,t)=>p.request("consume",t,{...quote(i),intentId:i.intentId,expiresAt:i.expiresAt}),
  accountIdentity:t=>p.request("identity",t),
  launch:i=>p.native.launch(i),restore:a=>p.native.restore(a),
  sync:(_intent,productId,purchaseToken,t)=>p.request("sync",t,{productId,purchaseToken})
 });
}
