import {playProduct, type PlayProduct} from "./play-products";
/** Interprets a trusted server-to-server subscriptionsv2 response only.
 * No API route, no payment acknowledgement, no entitlement grant or storage.
 * Eligible means a candidate for additional ownership/persistence checks. */
type Decision={state:"invalid"|"unsupported"|"inactive"|"pending_ack"|"eligible_for_reconciliation";product?:PlayProduct;expiresAt?:string};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const validAccount=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const expiry=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19);
export function classifyPlaySubscription(payload:unknown,expectedAccount:unknown,environment:"test"|"production",now=Date.now()):Decision{
 if(!obj(payload)||!validAccount(expectedAccount)||!Number.isFinite(now)||(environment!=="test"&&environment!=="production"))return {state:"invalid"};
 if(!obj(payload.externalAccountIdentifiers)||payload.externalAccountIdentifiers.obfuscatedExternalAccountId!==expectedAccount)return {state:"invalid"};
 // A testPurchase object is present for a license-test purchase only.
 if((environment==="test"&&!obj(payload.testPurchase))||(environment==="production"&&Object.hasOwn(payload,"testPurchase")))return {state:"invalid"};
 // Replacement chains, multiple items, add-ons, prepaid plans and offers
 // require explicit reconciliation. No optimistic access from these shapes.
 if(Object.hasOwn(payload,"linkedPurchaseToken")||!Array.isArray(payload.lineItems)||payload.lineItems.length!==1)return {state:"unsupported"};
 const item:unknown=payload.lineItems[0];
 if(!obj(item)||!obj(item.offerDetails)||!obj(item.autoRenewingPlan)||Object.hasOwn(item,"prepaidPlan")||Object.hasOwn(item.offerDetails,"offerId"))return {state:"unsupported"};
 const product=playProduct(item.productId,item.offerDetails.basePlanId);
 if(!product||!expiry(item.expiryTime))return {state:"invalid"};
 const expiresAt=item.expiryTime;
 const state=payload.subscriptionState;
 if(state!=="SUBSCRIPTION_STATE_ACTIVE"&&state!=="SUBSCRIPTION_STATE_IN_GRACE_PERIOD"&&state!=="SUBSCRIPTION_STATE_CANCELED")return {state:"inactive"};
 if(Date.parse(expiresAt)<=now)return {state:"inactive"};
 if(payload.acknowledgementState==="ACKNOWLEDGEMENT_STATE_PENDING")return {state:"pending_ack",product,expiresAt};
 if(payload.acknowledgementState!=="ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED")return {state:"invalid"};
 return {state:"eligible_for_reconciliation",product,expiresAt};
}

// Dedicated sandbox runtime path. The existing public read-only classifier
// continues to reject linked tokens. A linked fingerprint is only a candidate
// for the durable same-owner replacement transaction, not an access grant.
export function classifyPlayRuntimeSubscription(payload:unknown,expectedAccount:string,token:string,fingerprint:(token:string)=>string,now=Date.now()):Decision&{previousFingerprint?:string}{
 if(!obj(payload)||!Object.hasOwn(payload,"linkedPurchaseToken"))return classifyPlaySubscription(payload,expectedAccount,"test",now);
 const previous=payload.linkedPurchaseToken;
 if(typeof previous!=="string"||! /^[A-Za-z0-9._~-]{16,4096}$/.test(previous)||previous===token)return {state:"unsupported"};
 const copy={...payload};delete copy.linkedPurchaseToken;
 const result=classifyPlaySubscription(copy,expectedAccount,"test",now);
 if(result.state!=="pending_ack"&&result.state!=="eligible_for_reconciliation")return result;
 const digest=fingerprint(previous);
 if(!validAccount(digest)||digest===fingerprint(token))return {state:"unsupported"};
 return {...result,previousFingerprint:digest};
}
