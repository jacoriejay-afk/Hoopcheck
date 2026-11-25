import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { projectAttestedStandings } from "../../../../lib/hoopdata-standings-projection";
import { validApiSportsSeason } from "../../../../lib/hoopdata-api-sports-competition";
import { licensedStandingsView, standingsDisplayRights } from "../../../../lib/hoopdata-licensed-standings";
import type { RightsGrant } from "../../../../lib/hoopdata-provider-rights";
import LicensedStandingsTable from "../../../../components/LicensedStandingsTable";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"League standings | HoopCheck™",robots:{index:false,follow:false}};
export const maxDuration=15;
async function load(leagueId:string,season:string){
 const plan=process.env.HOOPDATA_STANDINGS_PREVIEW_PLAN??"";
 const raw=process.env.HOOPDATA_STANDINGS_PREVIEW_RIGHTS??"";
 if(!plan||!raw||raw.length>100000)return null;
 try{
  const grants:RightsGrant[]=JSON.parse(raw);
  if(!Array.isArray(grants)||grants.length>1000||!standingsDisplayRights(leagueId,plan,grants,new Date()).allowed)return null;
  const url=process.env.HOOPDATA_ISOLATED_SUPABASE_URL,key=process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY;
  const appUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,appKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||!appUrl||!appKey||key===appKey)return null;
  const isolated=new URL(url),app=new URL(appUrl);
  if(isolated.protocol!=="https:"||isolated.origin===app.origin||isolated.username||isolated.password||isolated.pathname!=="/"||isolated.search||isolated.hash)return null;
  const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
  const signal=AbortSignal.timeout(8000);
  const {data,error}=await db.rpc("hoopdata_read_standings_review",{p_league:leagueId,p_season:season}).abortSignal(signal);
  if(error||!data||data.mapping?.leagueId!==leagueId||data.snapshot?.leagueId!==leagueId||data.snapshot?.season!==season)return null;
  const p=projectAttestedStandings({...data,now:new Date()});
  if(p.state!=="eligible-for-publication"||p.rows.length>1000)return null;
  const ids=[...new Set(p.rows.map(r=>r.teamId))],teams:{id:string;name:string}[]=[];
  for(let n=0;n<ids.length;n+=100){
    const {data:rows,error:err}=await db.from("teams").select("id,name").eq("active",true).eq("league_id",leagueId).eq("basketball_type",data.mapping.side).in("id",ids.slice(n,n+100)).abortSignal(signal);
    if(err||!rows)return null;
    teams.push(...rows);
  }
  return licensedStandingsView(p,leagueId,plan,grants,teams,new Date());
 }catch{return null;}
}
export default async function LeagueStandings({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{season?:string|string[]}>}){
 if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_STANDINGS_WEB_PREVIEW_ENABLED!=="true")notFound();
 const leagueId=(await params).id.toLowerCase(),season=(await searchParams).season;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(leagueId)||typeof season!=="string"||!validApiSportsSeason(season))notFound();
 const view=await load(leagueId,season);
 return <main className="page-shell"><div className="page-container"><header className="hero-card"><p>HoopCheck™ · Licensed preview</p><h1>League standings</h1><Link href={`/leagues/${leagueId}`} prefetch={false}>Back to league</Link></header>{view?<LicensedStandingsTable key={view.expiresAt} view={view}/>:<section className="card"><h2>Standings unavailable</h2><p>Current standings cannot be verified or are not approved for display. No estimated ranks are shown.</p></section>}</div></main>;
}
