import "server-only";
import {playProduct,canPurchasePlayProduct} from "../../billing/play-products";
type Session={owner:string;role:string};
type Verified={state:string;product?:{productId:string;basePlanId:string};expiresAt?:string};
type Ports={enabled():boolean;authorize(request:Request):Promise<Session|null>;verify(owner:string,token:string):Promise<Verified>;now():number};
const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
const unavailable=()=>reply(503,{error:"Google Play test verification is unavailable."});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function readBody(request:Request):Promise<Record<string,unknown>|null>{
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??"")||Number(request.headers.get("content-length"))>8192||!request.body)return null;
 const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return null;}chunks.push(value);}
 const value:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));
 return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
 }catch{return null;}finally{reader.releaseLock();}
}
/** Test-only observation endpoint. Never writes, acknowledges, grants access,
 * returns purchase credentials, or accepts a client-supplied owner. */
export async function verifyPlayRequest(request:Request,ports:Ports):Promise<Response>{
 try{
  if(!ports.enabled())return unavailable();
  if(request.method!=="POST")return reply(405,{error:"Method not allowed."});
  const auth=await ports.authorize(request);
  if(!auth||!uuid.test(auth.owner))return reply(401,{error:"Sign in and verify your account."});
  const body=await readBody(request);
  if(!body||Object.keys(body).sort().join(",")!=="basePlanId,productId,purchaseToken"||typeof body.purchaseToken!=="string"||! /^[A-Za-z0-9._~-]{16,4096}$/.test(body.purchaseToken))return reply(400,{error:"Invalid purchase verification request."});
  const product=playProduct(body.productId,body.basePlanId);
  if(!product||!canPurchasePlayProduct(auth.role,product))return reply(403,{error:"This membership option is unavailable."});
  const result=await ports.verify(auth.owner,body.purchaseToken);
  const current=await ports.authorize(request);
  if(!ports.enabled()||!current||current.owner!==auth.owner||current.role!==auth.role)return unavailable();
  const eligible=["pending_ack","eligible_for_reconciliation"].includes(result.state)&&result.product?.productId===product.productId&&result.product.basePlanId===product.basePlanId&&typeof result.expiresAt==="string"&&Number.isFinite(Date.parse(result.expiresAt))&&Date.parse(result.expiresAt)>ports.now();
  // No provider response or membership tier is passed through.
  return reply(200,{owner:auth.owner,environment:"test",outcome:eligible?"verified_observation":"not_verified",membershipGranted:false});
 }catch{return unavailable();}
}
