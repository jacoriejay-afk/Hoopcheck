import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
// Review-only orchestration. No production adapter or scheduler is supplied.
// All effects must use a durable request/step idempotency key and lease fencing.
// Never infer completion from a timeout, a missing row, or an HTTP 202.
export const deletionSteps = [
  "approve_scope", "capture_completion_contact", "freeze_account_writes",
  "revoke_sessions", "preserve_lawful_billing_records", "revoke_apple_authorizations",
  "remove_user_media", "remove_or_anonymize_user_data", "delete_auth_identity",
  "verify_erasure", "notify_completion", "remove_completion_contact",
] as const;
export type DeletionStep = typeof deletionSteps[number];
export type DeletionLease = {
  requestId: string; ownerId: string; fence: string; completed: readonly DeletionStep[];
  policyVersion: string;
};
type StepResult = { confirmed: true; receipt: string };
export type DeletionAdapters = {
  enabled: () => Promise<boolean>;
  claim: () => Promise<DeletionLease | null>;
  // Must reject stale leases and guarantee one execution boundary per step.
  assertLease: (lease: DeletionLease) => Promise<void>;
  execute: (lease: DeletionLease, step: DeletionStep, idempotencyKey: string) => Promise<StepResult>;
  checkpoint: (lease: DeletionLease, step: DeletionStep, receipt: string) => Promise<void>;
  complete: (lease: DeletionLease) => Promise<void>;
  // Only store controlled codes, never error details, provider credentials or PII.
  fail: (lease: DeletionLease, code: "invalid_checkpoint" | "step_not_confirmed") => Promise<void>;
};
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function validCheckpointPrefix(value: unknown): value is readonly DeletionStep[] {
  return Array.isArray(value) && value.length <= deletionSteps.length &&
    Array.from(value).every((step,index)=>step===deletionSteps[index]);
}
export async function runDeletionCandidate(adapter: DeletionAdapters): Promise<"disabled"|"idle"|"completed"|"retry"> {
  if (!await adapter.enabled()) return "disabled";
  const claimed = await adapter.claim();
  if (!claimed) return "idle";
  if (typeof claimed.requestId!=="string" || !uuid.test(claimed.requestId) ||
      typeof claimed.ownerId!=="string" || !uuid.test(claimed.ownerId) ||
      typeof claimed.fence!=="string" || !uuid.test(claimed.fence) ||
      typeof claimed.policyVersion!=="string" || !claimed.policyVersion.trim() ||
      claimed.policyVersion.length>100 || !validCheckpointPrefix(claimed.completed)) {
    // Do not attempt to mutate a malformed lease supplied by the scheduler.
    throw new Error("Invalid deletion lease or checkpoint sequence.");
  }
  // Keep the authenticated request identity and checkpoint prefix immutable,
  // including when a supplied effect attempts to mutate its input.
  const lease: DeletionLease = Object.freeze({
    requestId:claimed.requestId, ownerId:claimed.ownerId, fence:claimed.fence,
    policyVersion:claimed.policyVersion, completed:Object.freeze([...claimed.completed]),
  });
  async function boundary() {
    if (!await adapter.enabled()) throw new Error("Deletion worker disabled.");
    await adapter.assertLease(lease);
    if (!await adapter.enabled()) throw new Error("Deletion worker disabled.");
  }
  try {
    for (const step of deletionSteps.slice(lease.completed.length)) {
      await boundary();
      const result = await adapter.execute(lease,step,lease.requestId+":"+step);
      if(result?.confirmed!==true||typeof result.receipt!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(result.receipt))
        throw new Error("Deletion step not acknowledged.");
      await boundary();
      await adapter.checkpoint(lease,step,result.receipt);
    }
    await boundary();
    await adapter.complete(lease);
    return "completed";
  } catch {
    // Disabled or fenced-out workers must leave the lease to expire, without
    // further writes. An in-flight effect cannot be canceled by this switch;
    // retries still depend on durable per-step idempotency.
    try { await boundary(); await adapter.fail(lease,"step_not_confirmed"); } catch { /* durable scheduler owns retry */ }
    return "retry";
  }
}

// Durable database RPC integration; no scheduler or live effect implementations registered.
type Effect = (lease: DeletionLease, idempotencyKey: string) => Promise<{confirmed:true;receipt:string}>;
export type DeletionEffects = Record<DeletionStep, Effect>;
type Rpc = {rpc:(name:string,args?:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
function bindings(lease: DeletionLease) {
 return {p_request:lease.requestId,p_owner:lease.ownerId,p_fence:lease.fence};
}
function decodeClaim(value:unknown):DeletionLease|null {
 if(!Array.isArray(value)||value.length>1)throw Error("Invalid deletion claim.");
 if(!value.length)return null;
 const row=value[0];
 if(!row||typeof row!=="object"||!uuid.test(row.request_id)||!uuid.test(row.owner_id)||!uuid.test(row.fence)||
  typeof row.policy_version!=="string"||!row.policy_version||row.policy_version.length>100||
  !validCheckpointPrefix(row.completed))throw Error("Invalid deletion claim.");
 return {requestId:row.request_id,ownerId:row.owner_id,fence:row.fence,policyVersion:row.policy_version,completed:row.completed};
}
export function createDeletionWorkerAdapter(client:Rpc,effects:DeletionEffects,enabled:boolean):DeletionAdapters {
 async function rpc(name:string,args?:Record<string,unknown>){
  const r=await client.rpc(name,args);
  if(r.error)throw Error("Deletion worker database acknowledgement failed.");
  return r.data;
 }
 async function acknowledged(name:string,args:Record<string,unknown>){
  if(await rpc(name,args)!==true)throw Error("Deletion worker transition not confirmed.");
 }
 const isEnabled=()=>enabled&&process.env.ACCOUNT_DELETION_WORKER_ENABLED==="true"&&deletionSteps.every(step=>typeof effects[step]==="function");
 return {
  enabled:async()=>isEnabled(),
  claim:async()=>decodeClaim(await rpc("claim_account_deletion_worker")),
  assertLease:async lease=>acknowledged("assert_account_deletion_worker",bindings(lease)),
  execute:async(lease,step,key)=>{
   if(!isEnabled()||key!==lease.requestId+":"+step||typeof effects[step]!=="function")throw Error("Deletion effect unavailable.");
   await acknowledged("assert_account_deletion_worker",bindings(lease));
   // The inner RPC is asynchronous: the outer orchestration boundary alone
   // cannot prevent a dispatch if the kill switch changes during this RPC.
   if(!isEnabled())throw Error("Deletion effect unavailable.");
   return effects[step](lease,key);
  },
  checkpoint:async(lease,step,receipt)=>acknowledged("checkpoint_account_deletion_worker",{...bindings(lease),p_step:step,p_receipt:receipt}),
  complete:async lease=>acknowledged("complete_account_deletion_worker",bindings(lease)),
  fail:async(lease,code)=>acknowledged("fail_account_deletion_worker",{...bindings(lease),p_code:code}),
 };
}
export async function runOneApprovedDeletion(client:Rpc,effects:DeletionEffects,enabled=false) {
 return runDeletionCandidate(createDeletionWorkerAdapter(client,effects,enabled));
}

/** Provider-specific worker step. Supply the reviewed Apple cryptographic
 * revoke helper from #1080 after dependency integration. Never log envelopes.
 * The worker may retry after an Apple success and before database ACK:
 * Apple documents that /auth/revoke returns 200 for previously invalidated tokens.
 */
export async function revokeDeletionAppleAuthorizations(client:Rpc,lease:DeletionLease,revoke:(envelope:string,owner:string,subject:string)=>Promise<void>) {
 const args=bindings(lease);
 async function list(){
  const r=await client.rpc("list_account_deletion_apple_revocations",args);
  if(r.error||!Array.isArray(r.data)||r.data.length>32)throw Error("Apple revocation scope not confirmed.");
  const seen=new Set<string>();
  for(const row of r.data){
   if(!row||typeof row.apple_subject!=="string"||!row.apple_subject||row.apple_subject.length>255||
      typeof row.envelope!=="string"||row.envelope.length>12000||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(row.envelope)||
      typeof row.envelope_digest!=="string"||!/^[a-f0-9]{64}$/.test(row.envelope_digest)||seen.has(row.apple_subject))throw Error("Invalid Apple revocation scope.");
   seen.add(row.apple_subject);
  }
  return r.data as {apple_subject:string;envelope:string;envelope_digest:string}[];
 }
 const rows=await list();
 for(const row of rows){
  const check=await client.rpc("assert_account_deletion_worker",args);
  if(check.error||check.data!==true)throw Error("Deletion lease lost.");
  await revoke(row.envelope,lease.ownerId,row.apple_subject);
  const ack=await client.rpc("ack_account_deletion_apple_revocation",{...args,p_subject:row.apple_subject,p_digest:row.envelope_digest});
  if(ack.error||ack.data!==true)throw Error("Apple revocation acknowledgement failed.");
 }
 if((await list()).length!==0)throw Error("Apple authorizations remain.");
 return {confirmed:true as const,receipt:"apple_revocations_verified"};
}

// Optional transactional delivery integration. No provider account, spend, or
// live activation is implied by this adapter. Key rotation/retention and
// verified non-relay contact availability must be approved before rollout.
type CompletionUser={id:string;email?:string;email_confirmed_at?:string};
type CompletionConfig={key:Buffer;apiKey:string;from:string};
export function createCompletionEffects(client:Rpc,readUser:(id:string)=>Promise<CompletionUser>,config:CompletionConfig,request:typeof fetch=fetch){
 const subject="Your HoopCheck account deletion is complete";
 const body="Your HoopCheck account deletion has been completed. Any independently managed subscription must still be managed with its billing provider. If you have questions, contact HoopCheck support.";
 const emailPattern=/^[^\s@<>(),;:\x00-\x1f\x7f]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/;
 if(config.key.length!==32||!config.apiKey||!emailPattern.test(config.from)||!config.from.toLowerCase().endsWith("@hoopcheck.online"))throw Error("Completion delivery not configured.");
 const aad=(l:DeletionLease)=>Buffer.from(JSON.stringify(["hoopcheck-deletion-contact-v1",l.requestId,l.ownerId,l.policyVersion]));
 const validContact=(email:unknown):email is string=>typeof email==="string"&&email.length<=254&&emailPattern.test(email)&&!email.toLowerCase().endsWith("@privaterelay.appleid.com");
 function seal(l:DeletionLease,email:string){
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",config.key,iv);
  cipher.setAAD(aad(l));
  const encrypted=Buffer.concat([cipher.update(email,"utf8"),cipher.final()]);
  return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
 }
 function unseal(l:DeletionLease,value:unknown){
  if(typeof value!=="string"||value.length>2048||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))throw Error("Completion contact invalid.");
  const [,i,t,c]=value.split(".");const iv=Buffer.from(i,"base64url"),tag=Buffer.from(t,"base64url");
  if(iv.length!==12||tag.length!==16)throw Error("Completion contact invalid.");
  const decipher=createDecipheriv("aes-256-gcm",config.key,iv);decipher.setAAD(aad(l));decipher.setAuthTag(tag);
  const email=Buffer.concat([decipher.update(Buffer.from(c,"base64url")),decipher.final()]).toString("utf8");
  if(!validContact(email))throw Error("Verified non-relay completion contact required.");
  return email;
 }
 async function action(l:DeletionLease,name:string,extra:Record<string,unknown>={}){
  const r=await client.rpc("account_deletion_completion_action",{...bindings(l),p_action:name,...extra});
  if(r.error||!r.data||typeof r.data!=="object"||Array.isArray(r.data))throw Error("Completion state unavailable.");
  return r.data as Record<string,unknown>;
 }
 async function mail(method:"GET"|"POST",path:string, payload?:unknown,key?:string){
  const result=await request("https://api.resend.com"+path,{method,headers:{Authorization:"Bearer "+config.apiKey,"Content-Type":"application/json",...(key?{"Idempotency-Key":key}:{})},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000),...(payload?{body:JSON.stringify(payload)}:{})});
  if(!result.ok)throw Error("Completion provider unavailable.");
  const value:unknown=await result.json();
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Completion provider response invalid.");
  return value as Record<string,unknown>;
 }
 return {
  capture_completion_contact:async(l:DeletionLease)=>{
   const old=await action(l,"capture_read");
   if(old.envelope){unseal(l,old.envelope);return {confirmed:true as const,receipt:"completion_contact_captured"};}
   const user=await readUser(l.ownerId);
   if(user.id!==l.ownerId||!user.email_confirmed_at||!validContact(user.email))throw Error("Verified non-relay completion contact required.");
   if((await action(l,"capture",{p_envelope:seal(l,user.email)})).ok!==true)throw Error("Completion contact not captured.");
   return {confirmed:true as const,receipt:"completion_contact_captured"};
  },
  notify_completion:async(l:DeletionLease)=>{
   let state=await action(l,"read");const email=unseal(l,state.envelope);
   if(state.delivered===true)return {confirmed:true as const,receipt:"completion_email_delivered"};
   if(!state.provider_id){
    state=await action(l,"begin");
    const start=typeof state.first_attempt_at==="string"?Date.parse(state.first_attempt_at):NaN;
    // Resend idempotency expires after 24h. Never automatically resend an
    // ambiguous delivery outside a conservative 23h reconciliation window.
    if(!Number.isFinite(start)||start>Date.now()+60000||Date.now()-start>=23*3600000)throw Error("Completion delivery requires reconciliation.");
    const sent=await mail("POST","/emails",{from:config.from,to:[email],subject,text:body},"deletion-complete/"+l.requestId);
    if(typeof sent.id!=="string"||!uuid.test(sent.id))throw Error("Completion acceptance unverified.");
    state=await action(l,"accepted",{p_provider:sent.id});
   }
   const id=state.provider_id;
   if(typeof id!=="string"||!uuid.test(id))throw Error("Completion provider ID invalid.");
   const delivery=await mail("GET","/emails/"+id);
   if(delivery.id!==id||!Array.isArray(delivery.to)||delivery.to.length!==1||delivery.to[0]!==email||delivery.subject!==subject||delivery.last_event!=="delivered")throw Error("Completion delivery not confirmed.");
   if((await action(l,"delivered",{p_provider:id})).delivered!==true)throw Error("Completion delivery not recorded.");
   return {confirmed:true as const,receipt:"completion_email_delivered"};
  },
  remove_completion_contact:async(l:DeletionLease)=>{
   if((await action(l,"scrub")).ok!==true)throw Error("Completion contact scrub not confirmed.");
   return {confirmed:true as const,receipt:"completion_contact_scrubbed"};
  },
 };
}
