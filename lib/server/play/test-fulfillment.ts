import "server-only";
import {canPurchasePlayProduct,playProduct,type PlayProduct} from "../../billing/play-products";
import type {SealedPurchase} from "./token-vault";
type Verified={state:string;product?:PlayProduct;expiresAt?:string};
type ClaimResult="claimed"|"already_claimed"|"foreign_owner"|"catalog_conflict"|"retry";
type Receipt={scope:"test";owner:string;fingerprint:string;productId:string;basePlanId:string;generation:number;expiresAt:string;committed:true};
type Outcome="held"|"verification_unavailable"|"ownership_conflict"|"pending_fulfillment"|"pending_acknowledgment"|"pending_reconciliation"|"test_fulfillment_confirmed";
type Context={owner:string;role:string;productId:string;basePlanId:string;token:string};
type Dependencies={
 // This must revalidate the exact authenticated session, MFA, account/role,
 // deletion freeze, reviewed purchase intent, and sandbox environment.
 authorize(input:Context):Promise<boolean>;
 verify(owner:string,token:string):Promise<Verified>;
 seal(token:string,owner:string,scope:"test"):SealedPurchase;
 claim(owner:string,product:PlayProduct,sealed:SealedPurchase):Promise<ClaimResult>;
 // A single transaction must commit test membership fulfillment against the
 // immutable claim + current generation before returning a durable receipt.
 fulfillTest(owner:string,product:PlayProduct,sealed:SealedPurchase,expiresAt:string):Promise<Receipt|null>;
 // Check the durable receipt and session again just before acknowledgment.
 confirmFulfillment(receipt:Receipt):Promise<boolean>;
 acknowledgeTest(receipt:Receipt,token:string):Promise<boolean>;
 reconcileTest(receipt:Receipt,verified:Verified):Promise<boolean>;
 now():number;
};
const validOwner=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const validFingerprint=/^[a-f0-9]{64}$/;
const matches=(v:Verified,p:PlayProduct,now:number)=>v.product?.productId===p.productId&&v.product.basePlanId===p.basePlanId&&typeof v.expiresAt==="string"&&Number.isFinite(Date.parse(v.expiresAt))&&Date.parse(v.expiresAt)>now;
function matchesReceipt(receipt:Receipt|null,owner:string,product:PlayProduct,sealed:SealedPurchase,expiresAt:string):receipt is Receipt{
 return !!receipt&&receipt.scope==="test"&&receipt.committed===true&&receipt.owner===owner&&receipt.fingerprint===sealed.fingerprint&&receipt.productId===product.productId&&receipt.basePlanId===product.basePlanId&&receipt.expiresAt===expiresAt&&Number.isSafeInteger(receipt.generation)&&receipt.generation>0;
}
/** Unwired test-only orchestration contract. No API handler, provider POST,
 * DB adapter, actual entitlement grant or client-callable acknowledgment.
 * Do not use until every dependency is implemented and independently accepted. */
export async function reconcileTestPurchase(input:Context,deps:Dependencies):Promise<Outcome>{
 try{
  const product=playProduct(input.productId,input.basePlanId);
  if(!validOwner.test(input.owner)||!product||!canPurchasePlayProduct(input.role,product)||typeof input.token!=="string"||! /^[A-Za-z0-9._~-]{16,4096}$/.test(input.token)||!await deps.authorize(input))return "held";
  const verified=await deps.verify(input.owner,input.token);
  if(!["pending_ack","eligible_for_reconciliation"].includes(verified.state)||!matches(verified,product,deps.now())||!verified.expiresAt)return "verification_unavailable";
  const sealed=deps.seal(input.token,input.owner,"test");
  if(sealed.version!==1||!validFingerprint.test(sealed.fingerprint))return "held";
  if(!await deps.authorize(input))return "held";
  const claim=await deps.claim(input.owner,product,sealed);
  if(claim==="foreign_owner"||claim==="catalog_conflict")return "ownership_conflict";
  if(claim!=="claimed"&&claim!=="already_claimed")return "pending_fulfillment";
  const receipt=await deps.fulfillTest(input.owner,product,sealed,verified.expiresAt);
  if(!matchesReceipt(receipt,input.owner,product,sealed,verified.expiresAt))return "pending_fulfillment";
  if(!await deps.authorize(input)||!await deps.confirmFulfillment(receipt))return "pending_fulfillment";
  // Verify again immediately before any acknowledgment. A provider state can
  // change while ownership/fulfillment is being persisted.
  const latest=await deps.verify(input.owner,input.token);
  if(!matches(latest,product,deps.now())||latest.expiresAt!==receipt.expiresAt)return "pending_reconciliation";
  if(latest.state==="pending_ack"){
   if(!await deps.authorize(input)||!await deps.confirmFulfillment(receipt))return "pending_fulfillment";
   if(!await deps.acknowledgeTest(receipt,input.token))return "pending_acknowledgment";
  }else if(latest.state!=="eligible_for_reconciliation")return "pending_reconciliation";
  const final=await deps.verify(input.owner,input.token);
  if(final.state!=="eligible_for_reconciliation"||!matches(final,product,deps.now())||final.expiresAt!==receipt.expiresAt||!await deps.authorize(input)||!await deps.confirmFulfillment(receipt))return "pending_reconciliation";
  return await deps.reconcileTest(receipt,final)?"test_fulfillment_confirmed":"pending_reconciliation";
 }catch{return "verification_unavailable";}
}
