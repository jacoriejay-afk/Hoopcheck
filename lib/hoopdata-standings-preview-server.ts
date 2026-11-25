import "server-only";
import { createClient } from "@supabase/supabase-js";
import { projectAttestedStandings } from "./hoopdata-standings-projection";
import { licensedStandingsView, standingsDisplayRights } from "./hoopdata-licensed-standings";
import type { RightsGrant } from "./hoopdata-provider-rights";
export async function loadLicensedStandings(leagueId:string,season:string,channel:"web-display"|"app-display",side?:"mens"|"womens",legacyLeagueId?:string){
 if(process.env.VERCEL_ENV!=="preview"||process.env[channel==="web-display"?"HOOPDATA_STANDINGS_WEB_PREVIEW_ENABLED":"HOOPDATA_STANDINGS_APP_PREVIEW_ENABLED"]!=="true")return null;
 const plan=process.env.HOOPDATA_STANDINGS_PREVIEW_PLAN??"";
 const raw=process.env.HOOPDATA_STANDINGS_PREVIEW_RIGHTS??"";
 if(!plan||!raw||raw.length>100000)return null;
 try{
  const grants:RightsGrant[]=JSON.parse(raw);
  if(!Array.isArray(grants)||grants.length>1000||!standingsDisplayRights(leagueId,plan,grants,new Date(),channel).allowed)return null;
  const url=process.env.HOOPDATA_ISOLATED_SUPABASE_URL,key=process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY;
  const appUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,appKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||!appUrl||!appKey||key===appKey)return null;
  const isolated=new URL(url),app=new URL(appUrl);
  if(isolated.protocol!=="https:"||isolated.origin===app.origin||isolated.username||isolated.password||isolated.pathname!=="/"||isolated.search||isolated.hash)return null;
  const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
  const signal=AbortSignal.timeout(8000);
  if(legacyLeagueId){
   const {data:legacy,error:legacyError}=await db.from("womens_leagues").select("id").eq("id",legacyLeagueId).eq("active",true).abortSignal(signal).maybeSingle();
   if(legacyError||legacy?.id!==legacyLeagueId||side!=="womens")return null;
  }
  const {data,error}=await db.rpc("hoopdata_read_standings_review",{p_league:leagueId,p_season:season}).abortSignal(signal);
  if(error||!data||data.mapping?.leagueId!==leagueId||data.snapshot?.leagueId!==leagueId||data.snapshot?.season!==season||(side!==undefined&&data.mapping?.side!==side))return null;
  const p=projectAttestedStandings({...data,now:new Date()});
  if(p.state!=="eligible-for-publication"||p.rows.length>1000)return null;
  const ids=[...new Set(p.rows.map(r=>r.teamId))],teams:{id:string;name:string}[]=[];
  for(let n=0;n<ids.length;n+=100){
    const {data:rows,error:err}=await db.from("teams").select("id,name").eq("active",true).eq("league_id",leagueId).eq("basketball_type",data.mapping.side).in("id",ids.slice(n,n+100)).abortSignal(signal);
    if(err||!rows)return null;
    teams.push(...rows);
  }
  return licensedStandingsView(p,leagueId,plan,grants,teams,new Date(),channel);
 }catch{return null;}
}
