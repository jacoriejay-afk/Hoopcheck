import "server-only";
import {playProduct,canPurchasePlayProduct} from "../../billing/play-products";

type Quote={productId:string;basePlanId:string;priceMicros:string;currency:string};
type Session={owner:string;sessionId:string;role:string};
type Bound=Quote&{owner:string;sessionId:string;accountId:string};
type Intent=Bound&{intentId:string;expiresAt:number};
type Ports={
 enabled():boolean;
 authorize(request:Request):Promise<Session|null>;
 accountId(owner:string):string;
 // Must return independently verified, localized full-price catalog evidence.
 quote(session:Session,quote:Quote):Promise<(Quote&{environment:"test";expiresAt:number})|null>;
 issue(bound:Bound):Promise<{intentId:string;expiresAt:number}|null>;
 consume(intent:Intent):Promise<boolean>;
 now():number;
};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
const same=(a:Session,b:Session|null)=>!!b&&a.owner===b.owner&&a.sessionId===b.sessionId&&a.role===b.role;
const equalQuote=(a:Quote,b:Quote)=>a.productId===b.productId&&a.basePlanId===b.basePlanId&&a.priceMicros===b.priceMicros&&a.currency===b.currency;
const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
const held=()=>reply(503,{error:"Google Play test purchase intent unavailable."});
const fresh=(expiresAt:number,now:number)=>Number.isSafeInteger(expiresAt)&&Number.isFinite(now)&&expiresAt>now&&expiresAt-now<=60000;
async function body(request:Request):Promise<Record<string,unknown>|null>{
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??"")||Number(request.headers.get("content-length"))>4096||!request.body)return null;
 const reader=request.body.getReader();let size=0;const parts:Uint8Array[]=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return null;}parts.push(value);}
 const parsed:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(parts)));
 return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:null;
 }catch{return null;}finally{reader.releaseLock();}
}
/** Isolated test request contract, deliberately not registered as a public route.
 * authorize must enforce verified Auth, MFA, freeze and deletion checks.
 * issue and consume must use durable atomic candidate functions; no memory fallback.
 * A successful consumption permits only a sandbox launch, not fulfillment. */
export async function playIntentRequest(request:Request,action:"issue"|"consume",ports:Ports):Promise<Response>{
 try{
  if(!ports.enabled())return held();
  if(request.method!=="POST")return reply(405,{error:"Method not allowed."});
  const authorized=await ports.authorize(request);
  if(!authorized||!uuid.test(authorized.owner)||!uuid.test(authorized.sessionId))return reply(401,{error:"Sign in and verify your account."});
  const session={...authorized};
  const input=await body(request);
  const keys=action==="issue"?"basePlanId,currency,priceMicros,productId":"basePlanId,currency,expiresAt,intentId,priceMicros,productId";
  if(!input||Object.keys(input).sort().join(",")!==keys||typeof input.priceMicros!=="string"||! /^[1-9][0-9]{0,15}$/.test(input.priceMicros)||typeof input.currency!=="string"||! /^[A-Z]{3}$/.test(input.currency))return reply(400,{error:"Invalid purchase intent."});
  const product=playProduct(input.productId,input.basePlanId);
  if(!product||!canPurchasePlayProduct(session.role,product))return reply(403,{error:"Membership option unavailable."});
  const quote:Quote={productId:product.productId,basePlanId:product.basePlanId,priceMicros:input.priceMicros,currency:input.currency};
  const accountId=ports.accountId(session.owner);
  if(!hex.test(accountId))return held();
  const verified=await ports.quote(session,quote);
  if(!verified||verified.environment!=="test"||!equalQuote(quote,verified)||!fresh(verified.expiresAt,ports.now()))return reply(409,{error:"Price changed or unavailable."});
  if(!ports.enabled()||!same(session,await ports.authorize(request))||!ports.enabled()||!fresh(verified.expiresAt,ports.now()))return held();
  const bound:Bound={...quote,owner:session.owner,sessionId:session.sessionId,accountId};
  if(action==="issue"){
   const issued=await ports.issue(bound);
   if(!issued)return reply(429,{error:"Too many test purchase intents."});
   if(!uuid.test(issued.intentId)||!fresh(issued.expiresAt,ports.now())||!ports.enabled()||!same(session,await ports.authorize(request))||!ports.enabled()||!fresh(issued.expiresAt,ports.now())||!fresh(verified.expiresAt,ports.now()))return held();
   return reply(200,{...quote,owner:session.owner,accountId,intentId:issued.intentId,expiresAt:issued.expiresAt,environment:"test"});
  }
  if(typeof input.intentId!=="string"||!uuid.test(input.intentId)||typeof input.expiresAt!=="number"||!fresh(input.expiresAt,ports.now()))return reply(409,{error:"Purchase intent expired or unavailable."});
  const consumed=await ports.consume({...bound,intentId:input.intentId,expiresAt:input.expiresAt});
  if(!consumed)return reply(409,{error:"Purchase intent expired or unavailable."});
  if(!ports.enabled()||!same(session,await ports.authorize(request))||!ports.enabled()||!fresh(input.expiresAt,ports.now())||!fresh(verified.expiresAt,ports.now()))return held();
  return reply(200,{owner:session.owner,intentId:input.intentId,environment:"test",outcome:"sandbox_launch_authorized",membershipGranted:false});
 }catch{return held();}
}
