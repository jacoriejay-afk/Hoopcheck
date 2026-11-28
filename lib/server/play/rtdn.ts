import "server-only";
import {PLAY_PACKAGE} from "../../billing/play-products";
type Wakeup={kind:"refresh"|"test"|"unsupported";messageId:string;token?:string;eventTimeMillis:number};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const opaque=/^[A-Za-z0-9._~-]{16,4096}$/;
const subscriptionPattern=/^projects\/[a-z][a-z0-9-]{4,62}\/subscriptions\/[A-Za-z][A-Za-z0-9._~-]{2,254}$/;
const invalid=()=>Error("Google Play notification could not be verified.");
/** Parser ONLY after independent authenticated Pub/Sub push verification.
 * A notification is a wake-up, not proof of ownership or access. Caller must
 * deduplicate durably by subscription + messageId, lookup the existing keyed
 * token fingerprint, and obtain fresh Google provider evidence. No public route. */
export function parseAuthenticatedPlayNotification(value:unknown,expectedSubscription:string,now=Date.now()):Wakeup{
 try{
  if(!subscriptionPattern.test(expectedSubscription)||!Number.isSafeInteger(now)||now<=0||
   !obj(value)||value.subscription!==expectedSubscription||!obj(value.message))throw invalid();
  const msg=value.message;
  if(typeof msg.messageId!=="string"||! /^[0-9]{1,64}$/.test(msg.messageId)||
   typeof msg.data!=="string"||msg.data.length>32768||! /^[A-Za-z0-9+/]+={0,2}$/.test(msg.data))throw invalid();
  const data=Buffer.from(msg.data,"base64");
  if(data.toString("base64")!==msg.data||data.length>24576)throw invalid();
  const payload:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data));
  if(!obj(payload)||payload.version!=="1.0"||payload.packageName!==PLAY_PACKAGE||
   typeof payload.eventTimeMillis!=="string"||! /^[0-9]{1,16}$/.test(payload.eventTimeMillis))throw invalid();
  const eventTimeMillis=Number(payload.eventTimeMillis);
  if(!Number.isSafeInteger(eventTimeMillis)||eventTimeMillis<=0||eventTimeMillis>now+300000)throw invalid();
  const kinds=["testNotification","subscriptionNotification","voidedPurchaseNotification","oneTimeProductNotification","pendingRefundReviewNotification"].filter(k=>Object.hasOwn(payload,k));
  if(kinds.length!==1||!obj(payload[kinds[0]]))throw invalid();
  const kind=kinds[0],body=payload[kind] as Record<string,unknown>;
  const common={messageId:msg.messageId,eventTimeMillis};
  if(kind==="testNotification"){if(body.version!=="1.0")throw invalid();return {...common,kind:"test"};}
  if(kind==="subscriptionNotification"){
   if(body.version!=="1.0"||!Number.isSafeInteger(body.notificationType)||Number(body.notificationType)<=0||
    typeof body.purchaseToken!=="string"||!opaque.test(body.purchaseToken))throw invalid();
   return {...common,kind:"refresh",token:body.purchaseToken};
  }
  if(kind==="voidedPurchaseNotification"&&body.productType===1){
   if(typeof body.purchaseToken!=="string"||!opaque.test(body.purchaseToken))throw invalid();
   return {...common,kind:"refresh",token:body.purchaseToken};
  }
  // No automated handling of one-time products or refund review decisions.
  return {...common,kind:"unsupported"};
 }catch{throw invalid();}
}
