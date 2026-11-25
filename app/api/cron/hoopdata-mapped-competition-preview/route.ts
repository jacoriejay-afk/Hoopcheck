import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runCompetitionTask, type CompetitionMapping, type CompetitionTask } from "../../../../lib/hoopdata-competition-worker";
import { validApiSportsSeason } from "../../../../lib/hoopdata-api-sports-competition";

export const dynamic="force-dynamic";
export const maxDuration=25;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:NextRequest){
  if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_MAPPED_COMPETITION_PREVIEW_ENABLED!=="true")return reply({error:"Disabled"},404);
  const secret=process.env.HOOPDATA_PREVIEW_CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return reply({error:"Unauthorized"},401);
  const url=process.env.HOOPDATA_ISOLATED_SUPABASE_URL,key=process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY,providerKey=process.env.HOOPDATA_PREVIEW_API_SPORTS_KEY;
  const appUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,appKey=process.env.SUPABASE_SERVICE_ROLE_KEY,appProvider=process.env.API_SPORTS_BASKETBALL_KEY;
  if(!url||!key||!appUrl||!providerKey||!appKey||!appProvider||key===appKey||providerKey===appProvider)return reply({error:"Isolated configuration required"},503);
  try{if(new URL(url).origin===new URL(appUrl).origin)return reply({error:"Isolated configuration required"},503);}catch{return reply({error:"Invalid configuration"},503);}
  let raw:unknown;
  try{raw=await request.json();}catch{return reply({error:"Invalid request"},400);}
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return reply({error:"Invalid request"},400);
  const {leagueId,kind,season}=raw as Record<string,unknown>;
  if(typeof leagueId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leagueId))return reply({error:"Invalid internal league ID"},400);
  if(!(kind==="seasons"&&season===undefined)&&!((kind==="games"||kind==="standings")&&typeof season==="string"&&validApiSportsSeason(season)))return reply({error:"Invalid competition task"},400);
  try{
    const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:m,error}=await db.from("hoopdata_competition_mappings").select("league_id,provider_league_id,side,reviewed,evidence").eq("league_id",leagueId).eq("reviewed",true).maybeSingle();
    if(error)return reply({error:"Reviewed mapping registry unavailable"},503);
    if(!m)return reply({error:"Reviewed mapping required"},403);
    const {data:league,error:leagueError}=await db.from("leagues").select("id,basketball_type,active").eq("id",leagueId).eq("active",true).maybeSingle();
    if(leagueError)return reply({error:"League registry unavailable"},503);
    if(!league||league.basketball_type!==m.side)return reply({error:"League mapping no longer valid"},403);
    const mapping:CompetitionMapping={leagueId:m.league_id,providerLeagueId:m.provider_league_id,side:m.side,reviewed:m.reviewed,evidence:m.evidence};
    const task:CompetitionTask=kind==="seasons"?{kind,mapping}:{kind:kind as "games"|"standings",mapping,season:season as string};
    const result=await runCompetitionTask(task,providerKey,{
      fetcher:fetch,now:()=>new Date(),
      reserve:async pool=>{const {data,error}=await db.rpc("hoopdata_reserve_request",{p_pool:pool});if(error)throw Error("Quota unavailable");return data===true;},
      blockUntil:async(pool,until)=>{const {data,error}=await db.rpc("hoopdata_block_provider",{p_pool:pool,p_until:until});if(error||data!==true)throw Error("Cooldown unavailable");},
      stage:async snapshot=>{const {data,error}=await db.rpc("hoopdata_stage_competition_snapshot",{p_league:leagueId,p_provider:mapping.providerLeagueId,p_side:mapping.side,p_kind:snapshot.kind,p_season:snapshot.kind==="seasons"?"":snapshot.season,p_observed:snapshot.observedAt,p_rows:snapshot.rows});return !error&&data===true;},
    });
    if(result.state!=="staged")return reply(result,result.state==="mapping-required"?403:result.state==="budget-blocked"?429:result.state==="budget-unavailable"||result.state==="stage-failed"?503:502);
    return reply({...result,leagueId,side:mapping.side,canonicalWrites:false,coverageCertified:false});
  }catch{return reply({error:"Isolated competition task unavailable"},503);}
}
