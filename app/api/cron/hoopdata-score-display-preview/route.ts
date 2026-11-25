import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic="force-dynamic";
export const maxDuration=10;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const score=(v:unknown)=>v===null||(typeof v==="number"&&Number.isSafeInteger(v)&&v>=0);
/** Rehearsal only; not a public game endpoint or provider scheduler. */
export async function GET(request:NextRequest){
  if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_SCORE_DISPLAY_PREVIEW_ENABLED!=="true")return reply({error:"Disabled"},404);
  const secret=process.env.HOOPDATA_PREVIEW_CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return reply({error:"Unauthorized"},401);
  const id=new URL(request.url).searchParams.get("gameId")??"";
  if(!uuid.test(id))return reply({error:"Invalid game"},400);
  const url=process.env.HOOPDATA_ISOLATED_SUPABASE_URL,key=process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY;
  const appUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,appKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||!appUrl||!appKey||key===appKey)return reply({error:"Isolated configuration required"},503);
  try{
    const isolated=new URL(url),app=new URL(appUrl);
    if(isolated.protocol!=="https:"||isolated.origin===app.origin||isolated.username||isolated.password)return reply({error:"Isolated configuration required"},503);
    const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data,error}=await db.rpc("hoopdata_read_score_display",{p_game:id}).abortSignal(AbortSignal.timeout(5000));
    if(error||!Array.isArray(data)||data.length>1)return reply({error:"Score unavailable"},503);
    if(!data.length)return reply({error:"Game not found"},404);
    const r=data[0];
    if(!r||typeof r.game_id!=="string"||r.game_id.toLowerCase()!==id.toLowerCase()||typeof r.status!=="string"||!score(r.home_score)||!score(r.away_score)||!["primary","balldontlie-nba"].includes(r.score_source))return reply({error:"Score unavailable"},503);
    const observed=r.score_updated_at===null?null:typeof r.score_updated_at==="string"?Date.parse(r.score_updated_at):NaN;
    const now=Date.now();
    if(observed!==null&&(!Number.isFinite(observed)||observed>now))return reply({error:"Score unavailable"},503);
    if(r.score_source==="balldontlie-nba"&&(r.status!=="live"||observed===null||now-observed>300000||r.home_score===null||r.away_score===null))return reply({error:"Score unavailable"},503);
    return reply({game:{id:r.game_id,status:r.status,home_score:r.home_score,away_score:r.away_score,score_updated_at:observed===null?null:new Date(observed).toISOString(),score_source:r.score_source},preview:true});
  }catch{return reply({error:"Score unavailable"},503);}
}
