import "server-only";
import {playProduct} from "../../billing/play-products";
import {parseAuthenticatedPlayNotification} from "./rtdn";
type Job={subscription:string;messageId:string;fingerprint:string;leaseId:string};
type Claim={owner:string;fingerprint:string;productId:string;basePlanId:string};
type Verification={state:string;product?:{productId:string;basePlanId:string};expiresAt?:string;lifecycle?:import("../../billing/play-subscription").PlayLifecycle|null};
type Ports={
 enabled():boolean;
 lease():Promise<Job|null>;
 lookup(fingerprint:string):Promise<Claim|null>;
 // Decrypt only the exact stored owner-bound credential; never log it.
 open(claim:Claim):Promise<string>;
 fingerprint(token:string):string;
 begin(claim:Claim):Promise<number|null>;
 verify(owner:string,token:string):Promise<Verification>;
 complete(claim:Claim,generation:number,state:string,expiry:string|null,lifecycle?:Verification["lifecycle"]):Promise<boolean>;
 finish(job:Job,success:boolean):Promise<boolean>;
 now():number;
};
const hex=/^[a-f0-9]{64}$/;
/** Unwired ingress contract. Authentication must be the independently
 * configured Google push verifier. A 2xx may be returned only after durable
 * enqueue; no provider token or payload is persisted by this contract. */
export async function ingestPlayPush(input:unknown,authorization:unknown,ports:{
 enabled():boolean;authenticate(authorization:unknown):Promise<void>;
 subscription:string;fingerprint(token:string):string;
 enqueue(subscription:string,messageId:string,fingerprint:string):Promise<string>;now():number;
}):Promise<"held"|"accepted"|"retry">{
 if(!ports.enabled())return "held";
 try{
  await ports.authenticate(authorization);
  if(!ports.enabled())return "held";
  const event=parseAuthenticatedPlayNotification(input,ports.subscription,ports.now());
  if(event.kind!=="refresh")return "accepted";
  if(!event.token)return "retry";
  const fingerprint=ports.fingerprint(event.token);
  if(!hex.test(fingerprint))return "retry";
  if(!ports.enabled())return "held";
  const result=await ports.enqueue(ports.subscription,event.messageId,fingerprint);
  return result==="queued"||result==="duplicate"?"accepted":"retry";
 }catch{return "retry";}
}
/** Unwired worker. Never grants access, creates ownership or acknowledges.
 * Unknown purchases retry for later recovery; a revoked/inactive observation
 * is committed only via fresh provider evidence and generation fencing. */
export async function reconcileOnePlayNotification(ports:Ports):Promise<"held"|"idle"|"done"|"retry">{
 if(!ports.enabled())return "held";
 let job:Job|null=null;
 try{
  job=await ports.lease();if(!job)return "idle";
  if(!hex.test(job.fingerprint))throw Error("invalid");
  const claim=await ports.lookup(job.fingerprint);
  if(!claim||claim.fingerprint!==job.fingerprint||!playProduct(claim.productId,claim.basePlanId))throw Error("unavailable");
  if(!ports.enabled())throw Error("held");
  const generation=await ports.begin(claim);
  if(!Number.isSafeInteger(generation)||generation===null||generation<=0||!ports.enabled())throw Error("unavailable");
  const token=await ports.open(claim);
  if(ports.fingerprint(token)!==job.fingerprint)throw Error("unavailable");
  if(!ports.enabled())throw Error("held");
  const result=await ports.verify(claim.owner,token);
  if(!ports.enabled())throw Error("held");
  let state="unavailable",expiry:string|null=null;
  if(result.state==="inactive")state="inactive";
  else if((result.state==="pending_ack"||result.state==="eligible_for_reconciliation")&&result.product?.productId===claim.productId&&result.product.basePlanId===claim.basePlanId&&typeof result.expiresAt==="string"&&Date.parse(result.expiresAt)>ports.now()){
   state=result.state;expiry=result.expiresAt;
  }
  const metadata=state==="unavailable"?undefined:result.lifecycle;
  if(!await (metadata?ports.complete(claim,generation,state,expiry,metadata):ports.complete(claim,generation,state,expiry)))throw Error("unavailable");
  if(state==="unavailable")throw Error("unavailable");
  return await ports.finish(job,true)?"done":"retry";
 }catch{if(job)try{await ports.finish(job,false);}catch{}return "retry";}
}
