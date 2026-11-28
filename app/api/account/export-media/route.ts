import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {assuranceForVerifiedUser} from "../../../../lib/auth/mfa-core";
import {readApprovedOriginalMedia,readApprovedOriginalRange,singleMediaLimit,strongMediaEtag} from "../../../../lib/server/account-export-media";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Vary":"Authorization"};
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const fail=(status:number)=>NextResponse.json({error:"Export media unavailable."},{status,headers});
export async function POST(request:Request){
 if(process.env.ACCOUNT_EXPORT_FULFILLMENT_ENABLED!=="true"||process.env.ACCOUNT_EXPORT_MEDIA_ENABLED!=="true")return fail(503);
 const token=request.headers.get("authorization")?.match(/^Bearer ([^\s]{1,16384})$/i)?.[1];
 if(!token)return fail(401);
 if(new URL(request.url).search||!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return fail(400);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return fail(503);
 try{
  const raw=await request.text();if(raw.length>1024)return fail(400);
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=="object"||Array.isArray(value))return fail(400);
  const body=value as Record<string,unknown>;
  if(typeof body.job!=="string"||!uuid.test(body.job)||!["manifest","download","chunk"].includes(String(body.action)))return fail(400);
  if(body.action==="manifest"&&(Object.keys(body).some(k=>!["action","job","after"].includes(k))||(body.after!==undefined&&body.after!==null&&(typeof body.after!=="string"||!uuid.test(body.after)))))return fail(400);
  if(body.action==="download"&&(Object.keys(body).some(k=>!["action","job","item"].includes(k))||typeof body.item!=="string"||!uuid.test(body.item)))return fail(400);
  if(body.action==="chunk"&&(process.env.ACCOUNT_EXPORT_MEDIA_RANGE_ENABLED!=="true"||Object.keys(body).some(k=>!["action","job","item","offset","etag"].includes(k))||typeof body.item!=="string"||!uuid.test(body.item)||typeof body.offset!=="number"||!Number.isSafeInteger(body.offset)||body.offset<0||!(body.etag===null||strongMediaEtag(body.etag))))return fail(400);
  const scoped=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const deadline=AbortSignal.any([request.signal,AbortSignal.timeout(60000)]);
  async function owner(){
   if(deadline.aborted)return null;
   const {data,error}=await scoped.auth.getUser(token);
   const user=data.user;
   if(error||!user?.email_confirmed_at||user.is_anonymous||!uuid.test(user.id))return null;
   const claims=await scoped.auth.getClaims(token);
   const jwt=claims.data?.claims;
   if(claims.error||!jwt||jwt.sub!==user.id||jwt.role!=="authenticated"||"client_id" in jwt||(jwt.is_anonymous!==undefined&&jwt.is_anonymous!==false)||assuranceForVerifiedUser(token!,user).required)return null;
   const active=await scoped.rpc("confirm_active_account_session").abortSignal(deadline);
   return !deadline.aborted&&!active.error&&active.data===true?user.id:null;
  }
  const uid=await owner();
  if(!uid)return fail(403);
  if(body.action==="manifest"){
   const result=await scoped.rpc("account_export_media_manifest",{p_job:body.job,p_after:body.after??null}).abortSignal(deadline);
   if(result.error||deadline.aborted)return fail(result.error?.code==="42501"?403:503);
   const d=result.data;
   if(!d||d.id!==body.job||d.complete!==false||!["pending_inventory","prepared"].includes(d.state)||!Array.isArray(d.items)||d.items.length>50||d.items.some((item:unknown)=>!item||typeof item!=="object"||!("id" in item)||typeof item.id!=="string"||!uuid.test(item.id)||!("bytes" in item)||typeof item.bytes!=="number"||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>134217728))return fail(503);
   const items=d.items.map((item:{id:string;bytes:number})=>({id:item.id,bytes:item.bytes}));
   if(new Set(items.map((item:{id:string})=>item.id)).size!==items.length||!(d.next_after===null||d.next_after===items.at(-1)?.id&&items.length===50))return fail(503);
   const pending=d.pending_count??0,denied=d.denied_count??0;
   if(!Number.isSafeInteger(pending)||pending<0||!Number.isSafeInteger(denied)||denied<0)return fail(503);
   if(await owner()!==uid||deadline.aborted)return fail(403);
   return NextResponse.json({id:body.job,complete:false,state:d.state,items,next_after:d.next_after,pending_count:pending,denied_count:denied},{headers});
  }
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey)return fail(503);
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const id=body.item as string,job=body.job;
  const resolve=async()=>{
   const result=await admin.rpc("resolve_account_export_media",{p_owner:uid,p_job:job,p_item:id}).abortSignal(deadline);
   if(result.error)throw Error("Media unavailable.");
   return result.data;
  };
  if(body.action==="chunk"){
   const source=new URL(url);
   if(source.protocol!=="https:"||source.username||source.password||source.pathname!=="/"||source.search||source.hash)throw Error("Storage origin unavailable.");
   const part=await readApprovedOriginalRange(id,body.offset as number,body.etag as string|null,resolve,async(locator,start,end,etag,signal)=>{
    const target=new URL(source.origin);
    target.pathname="/storage/v1/object/authenticated/"+encodeURIComponent(locator.bucket)+"/"+locator.path.split("/").map(encodeURIComponent).join("/");
    // Trusted configured origin only. The service key is never sent to a
    // caller-chosen URL and redirects are refused. Exact 206/range/ETag proof
    // is mandatory; a provider returning a full object fails closed.
    return fetch(target.toString(),{headers:{Authorization:"Bearer "+serviceKey,apikey:serviceKey,Range:`bytes=${start}-${end}`,"Accept-Encoding":"identity",...(etag?{"If-Match":etag}:{})},signal,redirect:"error",cache:"no-store"});
   },async()=>await owner()===uid,deadline);
   if(deadline.aborted)return fail(403);
   return new Response(part.buffer.buffer as ArrayBuffer,{status:206,headers:{...headers,"Content-Type":"application/octet-stream","Content-Length":String(part.buffer.byteLength),"Content-Range":`bytes ${part.start}-${part.end}/${part.total}`,ETag:part.etag}});
  }
  const bytes=await readApprovedOriginalMedia(id,resolve,async(locator,signal)=>{
   // Existing managed Storage API; no client-provided URL, no signed URL.
   if(signal.aborted||locator.bytes>singleMediaLimit)throw Error("Media unavailable; bounded range delivery required.");
   const r=await admin.storage.from(locator.bucket).download(locator.path);
   if(r.error||signal.aborted||!r.data)throw Error("Media unavailable.");
   return r.data;
  },async()=>await owner()===uid,deadline);
  if(deadline.aborted)return fail(403);
  return new Response(bytes,{headers:{...headers,"Content-Type":"application/octet-stream","Content-Disposition":'attachment; filename="hoopcheck-original-'+id+'.bin"',"Content-Length":String(bytes.size)}});
 }catch{return fail(503);}
}
