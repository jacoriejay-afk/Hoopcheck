import {playProduct,canPurchasePlayProduct} from "../../../../lib/billing/play-products";
import type {createPlayRecoveryJournal} from "./playRecoveryJournal";
type Session={owner:string;token:string;role:string};
type Quote={productId:string;basePlanId:string;priceMicros:string;currency:string};
type Intent=Quote&{owner:string;accountId:string;intentId:string;expiresAt:number;environment:"test"};
type Dependencies={
  enabled():boolean;
  available():boolean;
  session():Promise<Session|null>;
  prepare(quote:Quote,token:string):Promise<unknown>;
  consume(intent:Intent,token:string):Promise<unknown>;
  accountIdentity(token:string):Promise<unknown>;
  launch(intent:Intent):Promise<unknown>;
  restore(accountId:string):Promise<unknown>;
  sync(intentId:string|null,productId:string,purchaseToken:string,token:string):Promise<unknown>;
  journal:ReturnType<typeof createPlayRecoveryJournal>;
  now():number;
};
type Scope=Session&{generation:number};
type Result="held"|"launched"|"cancelled"|"restore_required"|"pending"|"test_verified"|"unavailable";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
const opaque=/^[A-Za-z0-9._~-]{16,4096}$/;
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const validQuote=(q:Quote)=>!!playProduct(q.productId,q.basePlanId)&&/^[1-9][0-9]{0,15}$/.test(q.priceMicros)&&/^[A-Z]{3}$/.test(q.currency);
const invalid=()=>Error("Google Play purchase could not be verified.");
/** Unwired sandbox coordinator. No actual native or HTTP adapter exists yet.
 * Its results never change the app's membership or acknowledge Google. */
export function createPlayPurchaseCoordinator(deps:Dependencies){
 let generation=0,owner:string|null=null,busy=false,prepared:Intent|null=null,preparedToken:string|null=null;
 // Do not open another sheet until the prior launch has been reconciled.
 // A native exception may occur after the provider sheet has opened.
 // The secure journal survives process death; no raw payment data persists.
 const allowed=()=>deps.enabled()&&deps.available();
 function invalidate(){generation++;prepared=null;preparedToken=null;}
 function check(scope:Scope){
  if(!allowed()||owner!==scope.owner||generation!==scope.generation)throw invalid();
 }
 async function capture():Promise<Scope>{
  if(!allowed()||!owner||!uuid.test(owner))throw invalid();
  const g=generation,o=owner;
  const s=await deps.session();
  if(!s||s.owner!==o||!s.token||generation!==g||!allowed())throw invalid();
  return {...s,generation:g};
 }
 async function current(scope:Scope){
  check(scope);
  const s=await deps.session();
  check(scope);
  if(!s||s.owner!==scope.owner||s.token!==scope.token||s.role!==scope.role)throw invalid();
 }
 function fresh(intent:Intent){const now=deps.now();return Number.isFinite(now)&&Number.isSafeInteger(intent.expiresAt)&&intent.expiresAt>now&&intent.expiresAt-now<=60000;}
 async function single<T>(fallback:T,work:()=>Promise<T>):Promise<T>{
  if(busy||!allowed())return fallback;
  busy=true;
  try{return await work();}catch{return fallback;}finally{busy=false;}
 }
  async function recover(accountId?:string):Promise<{verified:number;pending:number;failed:number}|null>{
   return single(null,async()=>{
    if(accountId!==undefined&&!hex.test(accountId))return null;
    const s=await capture();
    const identity=await deps.accountIdentity(s.token);await current(s);
    if(!obj(identity)||identity.owner!==s.owner||identity.environment!=="test"||typeof identity.accountId!=="string"||!hex.test(identity.accountId)||(accountId!==undefined&&identity.accountId!==accountId))return null;
    accountId=identity.accountId;
    const scan=await deps.restore(accountId);await current(s);
    if(!obj(scan)||scan.accountId!==accountId||!Array.isArray(scan.candidates)||scan.candidates.length>100||
     typeof scan.pendingCount!=="number"||!Number.isInteger(scan.pendingCount)||scan.pendingCount<0||scan.pendingCount>100)return null;
    let verified=0,failed=0;const seen=new Map<string,string>();
    const candidates:{productId:string;token:string}[]=[];
    for(const item of scan.candidates){
     await current(s);
     if(!obj(item)||typeof item.productId!=="string"||!["hoopcheck.pro","hoopcheck.premium"].includes(item.productId)||
      item.accountId!==accountId||typeof item.token!=="string"||!opaque.test(item.token)){failed++;continue;}
     const previous=seen.get(item.token);
     if(previous!==undefined){if(previous!==item.productId)return null;continue;}
     seen.set(item.token,item.productId);candidates.push({productId:item.productId,token:item.token});
    }
    for(const item of candidates){
     await current(s);
     const reply=await deps.sync(null,item.productId,item.token,s.token);
     await current(s);
     if(obj(reply)&&reply.owner===s.owner&&reply.environment==="test"&&reply.outcome==="test_fulfillment_confirmed")verified++;
     else failed++;
    }
    if(scan.pendingCount===0&&failed===0){await deps.journal.clear(s.owner,accountId);}
    else {await deps.journal.mark(s.owner,accountId);}
    await current(s);
    return {verified,pending:scan.pendingCount,failed};
   });
  }

 return {
  setOwner(next:string|null){if(next!==owner){invalidate();owner=next;}},
  invalidate,
  async prepare(quote:Quote):Promise<boolean>{
   return single(false,async()=>{
    prepared=null;preparedToken=null;
    if(!validQuote(quote))return false;
    const s=await capture(),product=playProduct(quote.productId,quote.basePlanId);
    if(await deps.journal.read())return false;
    await current(s);
    if(!product||!canPurchasePlayProduct(s.role,product))return false;
    const r=await deps.prepare({...quote},s.token);
    await current(s);
    if(!obj(r)||r.owner!==s.owner||r.environment!=="test"||typeof r.accountId!=="string"||!hex.test(r.accountId)||
     typeof r.intentId!=="string"||!uuid.test(r.intentId)||r.productId!==quote.productId||r.basePlanId!==quote.basePlanId||
     r.priceMicros!==quote.priceMicros||r.currency!==quote.currency||typeof r.expiresAt!=="number")return false;
    const candidate:Intent={...quote,owner:s.owner,environment:"test",accountId:r.accountId,intentId:r.intentId,expiresAt:r.expiresAt};
    if(!fresh(candidate))return false;
    prepared=candidate;preparedToken=s.token;return true;
   });
  },
  async launch():Promise<Result>{
   return single<Result>("held",async()=>{
    const intent=prepared,token=preparedToken;prepared=null;preparedToken=null;
    if(!intent||!fresh(intent))return "held";
    const s=await capture(),product=playProduct(intent.productId,intent.basePlanId);
    if(intent.owner!==s.owner||token!==s.token||!product||!canPurchasePlayProduct(s.role,product))return "held";
    await current(s);
    if(!fresh(intent))return "held";
    const permit=await deps.consume({...intent},s.token);
    await current(s);
    if(!fresh(intent)||!obj(permit)||permit.owner!==s.owner||permit.intentId!==intent.intentId||permit.environment!=="test"||permit.outcome!=="sandbox_launch_authorized"||permit.membershipGranted!==false)return "held";
    if(await deps.journal.read()||!await deps.journal.mark(s.owner,intent.accountId))return "held";
    await current(s);
    if(!fresh(intent))return "held";
    const result=await deps.launch({...intent});
    await current(s);
    if(result==="cancelled"&&!await deps.journal.clear(s.owner,intent.accountId))return "held";
    await current(s);
    return result==="launched"||result==="cancelled"||result==="restore_required"?result:"unavailable";
   });
  },
  recover,
  // A callback is only a signal to perform a fresh account-bound query. Never
  // accept its token, success flag, account ID or entitlement as authority.
  async purchaseUpdated(){return recover();},
  async foreground(){return recover();}

 };
}
