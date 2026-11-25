import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runCompetitionTask } from "../../../../lib/hoopdata-competition-worker";
import { runCompetitionRefreshTick } from "../../../../lib/hoopdata-competition-refresh";

export const dynamic="force-dynamic";
export const maxDuration=25;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
/** Preview-only one-tick executor. No cron registration or provider activation. */
export async function POST(request:NextRequest){
  if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_COMPETITION_REFRESH_PREVIEW_ENABLED!=="true")return reply({error:"Disabled"},404);
  const secret=process.env.HOOPDATA_PREVIEW_CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return reply({error:"Unauthorized"},401);
  const url=process.env.HOOPDATA_ISOLATED_SUPABASE_URL,key=process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY,providerKey=process.env.HOOPDATA_PREVIEW_API_SPORTS_KEY;
  const appUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,appKey=process.env.SUPABASE_SERVICE_ROLE_KEY,appProvider=process.env.API_SPORTS_BASKETBALL_KEY;
  if(!url||!key||!appUrl||!providerKey||!appKey||!appProvider||key===appKey||providerKey===appProvider)return reply({error:"Isolated configuration required"},503);
  try{if(new URL(url).origin===new URL(appUrl).origin)return reply({error:"Isolated configuration required"},503);}catch{return reply({error:"Invalid configuration"},503);}
  try{
    const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const result=await runCompetitionRefreshTick({
      now:()=>new Date(),
      claim:async()=>{const {data,error}=await db.rpc("hoopdata_claim_competition_refresh");if(error)throw Error("Queue unavailable");return data;},
      finish:async(claim,outcome)=>{const {data,error}=await db.rpc("hoopdata_finish_competition_refresh",{p_league:claim.leagueId,p_kind:claim.kind,p_token:claim.leaseToken,p_state:outcome.state,p_retry_at:outcome.retryAt??null});return !error&&data===true;},
      execute:(task,claim)=>runCompetitionTask(task,providerKey,{
        fetcher:fetch,now:()=>new Date(),
        reserve:async pool=>{const {data,error}=await db.rpc("hoopdata_reserve_request",{p_pool:pool});if(error)throw Error("Quota unavailable");return data===true;},
        blockUntil:async(pool,until)=>{const {data,error}=await db.rpc("hoopdata_block_provider",{p_pool:pool,p_until:until});if(error||data!==true)throw Error("Cooldown unavailable");},
        stage:async snapshot=>{const {data,error}=await db.rpc("hoopdata_stage_leased_competition_snapshot",{p_token:claim.leaseToken,p_league:snapshot.mapping.leagueId,p_provider:snapshot.mapping.providerLeagueId,p_side:snapshot.mapping.side,p_kind:snapshot.kind,p_season:snapshot.kind==="seasons"?"":snapshot.season,p_observed:snapshot.observedAt,p_rows:snapshot.rows});return !error&&data===true;},
      }),
    });
    return reply({...result,canonicalWrites:false,coverageCertified:false},["failed","lease-lost","invalid-claim"].includes(result.state)?503:200);
  }catch{return reply({error:"Isolated competition refresh unavailable"},503);}
}
