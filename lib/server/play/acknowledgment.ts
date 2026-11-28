import "server-only";
import {PLAY_PACKAGE,playProduct} from "../../billing/play-products";
type Receipt={owner:string;fingerprint:string;productId:string;basePlanId:string;expiresAt:string;generation:number;scope:"test";committed:true};
type Verified={state:string;product?:{productId:string;basePlanId:string};expiresAt?:string};
type Ports={
 // No default transport. Real fulfillment and Google OAuth adapter must be
 // independently reviewed before this candidate can be wired to a network.
 verify(owner:string,token:string):Promise<Verified>;
 fingerprint(token:string):string;
 confirmDurableFulfillment(receipt:Receipt):Promise<boolean>;
 accessToken():Promise<string>;
 request:typeof fetch;
 now():number;
};
type Outcome="held"|"already_acknowledged"|"reverify_required"|"unavailable";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
const tokenPattern=/^[A-Za-z0-9._~-]{16,4096}$/;
/** Unwired acknowledgment adapter contract. Only explicit test transports;
 * synthetic fulfillment records MUST NOT be used to acknowledge real payments.
 * A successful HTTP response still requires a fresh provider reconciliation. */
export async function acknowledgeTestPurchase(receipt:Receipt,token:string,ports:Ports):Promise<Outcome>{
 try{
  if(!receipt||receipt.scope!=="test"||receipt.committed!==true||!uuid.test(receipt.owner)||
    !hex.test(receipt.fingerprint)||!playProduct(receipt.productId,receipt.basePlanId)||
    !Number.isSafeInteger(receipt.generation)||receipt.generation<=0||
    !Number.isFinite(ports.now())||!Number.isFinite(Date.parse(receipt.expiresAt))||Date.parse(receipt.expiresAt)<=ports.now()||
    typeof token!=="string"||!tokenPattern.test(token)||ports.fingerprint(token)!==receipt.fingerprint)return "held";
  if(!await ports.confirmDurableFulfillment(receipt))return "held";
  const verified=await ports.verify(receipt.owner,token);
  if(verified.product?.productId!==receipt.productId||verified.product?.basePlanId!==receipt.basePlanId||
   verified.expiresAt!==receipt.expiresAt||Date.parse(receipt.expiresAt)<=ports.now())return "held";
  if(verified.state==="eligible_for_reconciliation")return "already_acknowledged";
  if(verified.state!=="pending_ack")return "held";
  const bearer=await ports.accessToken();
  if(typeof bearer!=="string"||! /^[A-Za-z0-9._~+\/-]{1,8192}={0,2}$/.test(bearer))return "unavailable";
  if(!await ports.confirmDurableFulfillment(receipt)||Date.parse(receipt.expiresAt)<=ports.now())return "held";
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const url="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"+PLAY_PACKAGE+"/purchases/subscriptions/"+encodeURIComponent(receipt.productId)+"/tokens/"+encodeURIComponent(token)+":acknowledge";
   const response=await ports.request(url,{method:"POST",headers:{Authorization:"Bearer "+bearer,"Content-Type":"application/json"},body:"{}",redirect:"error",cache:"no-store",signal:controller.signal});
   // No raw provider response is parsed, returned or logged.
   await response.body?.cancel();
   return response.ok&&!response.redirected?"reverify_required":"unavailable";
  }finally{clearTimeout(timer);}
 }catch{return "unavailable";}
}
