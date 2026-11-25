import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchCompetitionSnapshot, type CompetitionQuery } from "../../../../lib/hoopdata-competition-fetch";
import { validApiSportsSeason } from "../../../../lib/hoopdata-api-sports-competition";

export const dynamic="force-dynamic";
export const maxDuration=25;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:NextRequest){
  if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_COMPETITION_PREVIEW_ENABLED!=="true")return reply({error:"Disabled"},404);
  const secret=process.env.HOOPDATA_PREVIEW_CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return reply({error:"Unauthorized"},401);
  const url=process.env.HOOPDATA_ISOLATED_SUPABASE_URL,key=process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY,providerKey=process.env.HOOPDATA_PREVIEW_API_SPORTS_KEY;
  const appUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,appKey=process.env.SUPABASE_SERVICE_ROLE_KEY,appProvider=process.env.API_SPORTS_BASKETBALL_KEY;
  if(!url||!key||!appUrl||!providerKey||!appKey||!appProvider||key===appKey||providerKey===appProvider)return reply({error:"Isolated configuration required"},503);
  try{if(new URL(url).origin===new URL(appUrl).origin)return reply({error:"Isolated configuration required"},503);}catch{return reply({error:"Invalid configuration"},503);}
  let raw:unknown;
  try{raw=await request.json();}catch{return reply({error:"Invalid query"},400);}
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return reply({error:"Invalid query"},400);
  const {endpoint,league,season}=raw as Record<string,unknown>;
  if(typeof league!=="number"||!Number.isSafeInteger(league)||league<=0)return reply({error:"Invalid league"},400);
  let query:CompetitionQuery;
  if(endpoint==="leagues"&&season===undefined)query={endpoint,league};
  else if((endpoint==="games"||endpoint==="standings")&&typeof season==="string"&&validApiSportsSeason(season))query={endpoint,league,season};
  else return reply({error:"Invalid query"},400);
  try{
    const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    // Refuse arbitrary/unreviewed league IDs; candidate registry is isolated and empty by default.
    const {data:approval,error:approvalError}=await db.from("hoopdata_competition_preview_targets").select("league_id").eq("league_id",league).eq("enabled",true).maybeSingle();
    if(approvalError)return reply({error:"Target registry unavailable"},503);
    if(!approval)return reply({error:"Target not approved"},403);
    const snapshot=await fetchCompetitionSnapshot(query,providerKey,{
      fetcher:fetch,now:()=>new Date(),
      reserve:async pool=>{const {data,error}=await db.rpc("hoopdata_reserve_request",{p_pool:pool});if(error)throw Error("Quota unavailable");return data===true;},
      blockUntil:async(pool,until)=>{const {data,error}=await db.rpc("hoopdata_block_provider",{p_pool:pool,p_until:until});if(error||data!==true)throw Error("Cooldown unavailable");},
    });
    if(snapshot.state!=="ok")return reply(snapshot,snapshot.state==="budget-blocked"?429:snapshot.state==="budget-unavailable"?503:502);
    const {error}=await db.from("hoopdata_competition_preview_snapshots").insert({
      league_id:league,endpoint:snapshot.endpoint,season:query.endpoint==="leagues"?null:query.season,
      observed_at:snapshot.observedAt,rows:snapshot.rows,
    });
    if(error)return reply({error:"Snapshot storage failed"},503);
    return reply({state:"snapshot-staged",endpoint:snapshot.endpoint,league,rows:snapshot.rows.length,observedAt:snapshot.observedAt,canonicalWrites:false,coverageCertified:false});
  }catch{return reply({error:"Isolated snapshot unavailable"},503);}
}
