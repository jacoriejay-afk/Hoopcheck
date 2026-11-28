import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assuranceForVerifiedUser } from "../../../../lib/auth/mfa-core";

export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Vary":"Authorization"};
const fail=(status:number)=>NextResponse.json({error:"Account export is unavailable."},{status,headers});
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const states=new Set(["queued","ready","failed","cancelled","expired"]);
export async function POST(request:Request){
 if(process.env.ACCOUNT_EXPORT_FULFILLMENT_ENABLED!=="true")return fail(503);
 if(new URL(request.url).search||!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return fail(400);
 const token=request.headers.get("authorization")?.match(/^Bearer ([^\s]{1,16384})$/i)?.[1];
 if(!token)return fail(401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return fail(503);
 try{
  const text=await request.text();
  if(text.length>1024)return fail(400);
  const input:unknown=JSON.parse(text);
  if(!input||typeof input!=="object"||Array.isArray(input))return fail(400);
  const body=input as Record<string,unknown>;
  if(Object.keys(body).some(k=>!["action","job","after"].includes(k))||typeof body.action!=="string"||!["request","status","cancel","download"].includes(body.action)||typeof body.job!=="string"||!uuid.test(body.job))return fail(400);
  const after=body.after??0;
  if(typeof after!=="number"||!Number.isSafeInteger(after)||after<0||(body.action!=="download"&&after!==0))return fail(400);
  const scoped=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const deadline=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]);
  async function verify(){
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
  const owner=await verify();
  if(!owner)return fail(403);
  const result=await scoped.rpc("account_export_job",{p_action:body.action,p_job:body.job,p_after:after}).abortSignal(deadline);
  if(result.error||deadline.aborted)return fail(result.error?.code==="42501"?403:503);
  const data=result.data;
  if(!data||typeof data!=="object"||Array.isArray(data)||typeof data.id!=="string"||!uuid.test(data.id)||data.scope!=="owned-records-v1"||data.complete!==false||!Number.isSafeInteger(data.row_count)||data.row_count<0||data.row_count>1000000)return fail(503);
  if(body.action!=="request"&&data.id!==body.job)return fail(503);
  if(body.action==="download"){
   if(!Array.isArray(data.rows)||data.rows.length!==Math.min(50,data.row_count-after)||data.rows.some((r:unknown,i:number)=>!r||typeof r!=="object"||!("ordinal" in r)||r.ordinal!==after+i+1)||data.next_after!==(after+data.rows.length<data.row_count?after+data.rows.length:null)||typeof data.expires_at!=="string"||!Number.isFinite(Date.parse(data.expires_at))||Date.parse(data.expires_at)<=Date.now())return fail(503);
  }else if(!states.has(data.state))return fail(503);
  if(await verify()!==owner||deadline.aborted)return fail(403);
  if(body.action==="download"&&Date.parse(data.expires_at)<=Date.now())return fail(403);
  return NextResponse.json(data,{headers});
 }catch{return fail(503);}
}
