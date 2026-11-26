import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { projectAttestedStandings } from "../../../../lib/hoopdata-standings-projection";
import { validApiSportsSeason } from "../../../../lib/hoopdata-api-sports-competition";
export const dynamic="force-dynamic";
export const maxDuration=10;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
/** Isolated operator-only rehearsal; not a public standings API. */
export async function GET(request:NextRequest){
 if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_STANDINGS_DISPLAY_PREVIEW_ENABLED!=="true")return reply({error:"Disabled"},404);
 const secret=process.env.HOOPDATA_PREVIEW_CRON_SECRET;
 if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return reply({error:"Unauthorized"},401);
 const params=new URL(request.url).searchParams;
 const league=(params.get("leagueId")??"").toLowerCase(),season=params.get("season")??"";
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(league)||!validApiSportsSeason(season))return reply({error:"Invalid competition"},400);
 const url=process.env.HOOPDATA_ISOLATED_SUPABASE_URL,key=process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY;
 const appUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,appKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!appUrl||!appKey||key===appKey)return reply({error:"Isolated configuration required"},503);
 try{
  const isolated=new URL(url),app=new URL(appUrl);
  if(isolated.protocol!=="https:"||isolated.origin===app.origin||isolated.username||isolated.password)return reply({error:"Isolated configuration required"},503);
  const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await db.rpc("hoopdata_read_standings_review",{p_league:league,p_season:season}).abortSignal(AbortSignal.timeout(5000));
  if(error)return reply({error:"Standings unavailable"},503);
  if(!data)return reply({state:"unavailable",preview:true});
  if(data.mapping?.leagueId!==league||data.snapshot?.leagueId!==league||data.snapshot?.season!==season)return reply({error:"Standings unavailable"},503);
  const projected=projectAttestedStandings({...data,now:new Date()});
  return reply({...projected,preview:true});
 }catch{return reply({error:"Standings unavailable"},503);}
}
