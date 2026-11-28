import "server-only";
import {playProduct,canPurchasePlayProduct} from "../../billing/play-products";
import {playIntentRequest} from "./intent-request";
import {reconcileTestPurchase} from "./test-fulfillment";
import type {createDisposablePlayAdapters} from "./disposable-adapters";
import type {createPlayTokenVault} from "./token-vault";
import type {createPlayVerificationClient} from "./verification";
type Session={owner:string;sessionId:string;role:string};
type Quote={productId:string;basePlanId:string;priceMicros:string;currency:string};
type Db=ReturnType<typeof createDisposablePlayAdapters>;
type Provider=ReturnType<typeof createPlayVerificationClient>;
type Receipt={owner:string;fingerprint:string;productId:string;basePlanId:string;generation:number;expiresAt:string;scope:"test";committed:true};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const same=(a:Session,b:Session|null)=>!!b&&a.owner===b.owner&&a.sessionId===b.sessionId&&a.role===b.role;
/** In-process disposable runtime. No public route, network defaults, real
 * acknowledgment, or live membership mutation. Authentication must be
 * verified by the injected session authority, not a caller-supplied owner. */
export function createDisposablePlayRuntime(p:{
 scope:"disposable_pg17";enabled():boolean;authorize(request:Request):Promise<Session|null>;
 catalog(session:Session):Promise<(Quote&{environment:"test";expiresAt:number})[]>;
 db:Db;vault:ReturnType<typeof createPlayTokenVault>;provider:Provider;
 simulateAcknowledgment(receipt:Receipt,token:string):Promise<boolean>;now():number;
}){
 if(p.scope!=="disposable_pg17")throw Error("Disposable runtime required");
 const auth=async(request:Request)=>{
  if(!p.enabled())return null;
  const s=await p.authorize(request);
  if(!s||!uuid.test(s.owner)||!uuid.test(s.sessionId)||await p.db.ownerHeld(s.owner)||!p.enabled())return null;
  return {...s};
 };
 const accountId=(owner:string)=>p.provider.accountId(owner);
 const confirm=(r:Receipt)=>p.db.confirm(r,r.generation,r.expiresAt);
 const intentPorts={enabled:p.enabled,authorize:auth,accountId,quote:async(s:Session,q:Quote)=>{
  const rows=await p.catalog(s);
  const matches=rows.filter(v=>v.productId===q.productId&&v.basePlanId===q.basePlanId&&v.priceMicros===q.priceMicros&&v.currency===q.currency);
  return matches.length===1?matches[0]:null;
 },issue:p.db.issue,consume:p.db.consume,now:p.now};
 return {
  intent:(request:Request,action:"issue"|"consume")=>playIntentRequest(request,action,intentPorts),
  async notificationVerify(owner:string,token:string):Promise<Awaited<ReturnType<Provider["verifyRuntime"]>>>{
   if(!p.enabled()||await p.db.ownerHeld(owner))return {state:"invalid"};
   const fingerprint=(t:string)=>p.vault.fingerprint(t,"test"),current=await p.db.lookup(fingerprint(token));
   if(!current||current.owner!==owner)return {state:"invalid"};
   const v=await p.provider.verifyRuntime(owner,token,fingerprint);
   if(v.state==="inactive")return v;
   if(!p.enabled()||await p.db.ownerHeld(owner)||!await p.db.replacementMatches(current,v.previousFingerprint??null))return {state:"unsupported"};
   return v;
  },
  async identity(request:Request){try{const s=await auth(request);return s?{owner:s.owner,accountId:accountId(s.owner),environment:"test"}:null;}catch{return null;}},
  async sync(request:Request,productId:string,token:string){
   try{
    const s=await auth(request);
    if(!s||typeof token!=="string"||! /^[A-Za-z0-9._~-]{16,4096}$/.test(token))return null;
    const fingerprint=(t:string)=>p.vault.fingerprint(t,"test");
    const first=await p.provider.verifyRuntime(s.owner,token,fingerprint);
    if(!first.product||first.product.productId!==productId||!canPurchasePlayProduct(s.role,first.product)||!same(s,await auth(request)))return null;
    const product=playProduct(productId,first.product.basePlanId);
    if(!product)return null;
    const current=async()=>same(s,await auth(request));
    const previous=first.previousFingerprint;
    const verify=async(o:string,t:string):Promise<Awaited<ReturnType<Provider["verifyRuntime"]>>>=>{const v=await p.provider.verifyRuntime(o,t,fingerprint);return v.previousFingerprint===previous?v:{state:"unsupported" as const};};
    const fulfill=(c:Receipt|{owner:string;fingerprint:string;productId:string;basePlanId:string},g:number,state:string,expiry:string)=>previous?p.db.fulfillReplacement(c,g,state,expiry,previous):p.db.fulfill(c,g,state,expiry);
    const outcome=await reconcileTestPurchase({owner:s.owner,role:s.role,productId,basePlanId:product.basePlanId,token},{
     now:p.now,authorize:current,verify,seal:p.vault.seal,
     claim:(o,v,sealed)=>previous?p.db.claimReplacement(o,accountId(o),previous,v,sealed):p.db.claimBound(o,accountId(o),v,sealed),
     async fulfillTest(o,v,sealed,expiresAt){
      const c={owner:o,fingerprint:sealed.fingerprint,productId:v.productId,basePlanId:v.basePlanId};
      const g=await p.db.begin(c);if(g===null)return null;
      const verified=await verify(o,token);
      if(!await current()||verified.product?.productId!==v.productId||verified.product.basePlanId!==v.basePlanId||verified.expiresAt!==expiresAt||!await fulfill(c,g,verified.state,expiresAt))return null;
      return {...c,scope:"test",generation:g,expiresAt,committed:true};
     },
     confirmFulfillment:confirm,
     async acknowledgeTest(receipt,t){return await current()&&await confirm(receipt)&&await p.simulateAcknowledgment(receipt,t);},
     async reconcileTest(receipt,v){const g=await p.db.begin(receipt);return g!==null&&await current()&&v.expiresAt===receipt.expiresAt&&await fulfill(receipt,g,v.state,receipt.expiresAt);}
    });
    return await current()?{owner:s.owner,environment:"test",outcome,membershipGranted:false}:null;
   }catch{return null;}
  }
 };
}
