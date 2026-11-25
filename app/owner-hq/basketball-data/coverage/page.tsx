import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { requireAmbassadorSession } from "../../../../lib/ambassador/server";
import { auditLeagueCoverage } from "../../../../lib/hoopdata-coverage-audit";
import type { RightsGrant } from "../../../../lib/hoopdata-provider-rights";
export const dynamic="force-dynamic";
export const maxDuration=15;
export const metadata:Metadata={title:"Coverage audit | HoopCheck™ Owner HQ",robots:{index:false,follow:false}};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Side="mens"|"womens";
const labels:Record<string,string>={"unmapped":"Mapping missing","mapping-review-required":"Mapping needs review","season-unverified":"Season unverified","unsupported":"Provider reports unsupported","support-unconfirmed":"Support unconfirmed","no-observation":"No valid observation","stale-observation":"Observation stale","rights-unconfirmed":"Display rights unconfirmed","observed-not-certified":"Observed; completeness unverified"};
type LeagueName={id:string;name:string;country:string|null;side:Side;active:boolean};
type Quota={pool:string;enabled:boolean;minuteUsed:number;minuteLimit:number;dayUsed:number;dayLimit:number;blockedUntil:string|null};
async function load(side:Side,after:string|null){
 try{
  const url=process.env.HOOPDATA_ISOLATED_SUPABASE_URL,key=process.env.HOOPDATA_ISOLATED_SUPABASE_SERVICE_KEY,appUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,appKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||!appUrl||!appKey||key===appKey)return null;
  const isolated=new URL(url),app=new URL(appUrl);
  if(isolated.protocol!=="https:"||isolated.origin===app.origin||isolated.username||isolated.password||isolated.pathname!=="/"||isolated.search||isolated.hash)return null;
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
  const {data,error}=await db.rpc("hoopdata_read_owner_coverage_page",{p_side:side,p_after:after,p_limit:40}).abortSignal(AbortSignal.timeout(8000));
  if(error||!data||!Array.isArray(data.leagues)||data.leagues.length>40||!Array.isArray(data.mappings)||data.mappings.length>40||!Array.isArray(data.seasons)||data.seasons.length>40||!Array.isArray(data.observations)||data.observations.length>12000||!Array.isArray(data.quotas)||data.quotas.length>2)return null;
  const leagues:LeagueName[]=data.leagues;
  if(leagues.some(l=>!l||!uuid.test(l.id)||l.side!==side||l.active!==true||typeof l.name!=="string"||!l.name.trim()||!(l.country===null||typeof l.country==="string")))return null;
  const ids=new Set(leagues.map(l=>l.id));
  if(ids.size!==leagues.length||data.nextCursor!==null&&(!uuid.test(data.nextCursor)||data.nextCursor!==leagues.at(-1)?.id))return null;
  const quotas:Quota[]=data.quotas;
  if(quotas.some(q=>!q||!["api-sports-basketball","balldontlie"].includes(q.pool)||typeof q.enabled!=="boolean"||![q.minuteUsed,q.minuteLimit,q.dayUsed,q.dayLimit].every(v=>Number.isSafeInteger(v)&&v>=0)||!(q.blockedUntil===null||typeof q.blockedUntil==="string"&&Number.isFinite(Date.parse(q.blockedUntil)))))return null;
  const raw=process.env.HOOPDATA_STANDINGS_PREVIEW_RIGHTS??"",plan=process.env.HOOPDATA_STANDINGS_PREVIEW_PLAN??"";
  let rights:RightsGrant[]=[];
  if(raw&&raw.length<=100000){try{const parsed=JSON.parse(raw);if(Array.isArray(parsed)&&parsed.length<=1000)rights=parsed;}catch{/* unavailable rights must not look approved */}}
  const now=new Date();
  const audit=auditLeagueCoverage({leagues,mappings:data.mappings,seasons:data.seasons,observations:data.observations,rights,plan,now});
  const rows=audit.map(r=>({...r,name:leagues.find(l=>l.id===r.leagueId)!.name,country:leagues.find(l=>l.id===r.leagueId)!.country}));
  return {rows,quotas:quotas.map(q=>({...q,cooldownActive:q.blockedUntil!==null&&Date.parse(q.blockedUntil)>now.getTime()})),nextCursor:data.nextCursor as string|null};
 }catch{return null;}
}
export default async function CoveragePage({searchParams}:{searchParams:Promise<{side?:string|string[];after?:string|string[]}>}){
 if(process.env.VERCEL_ENV!=="preview"||process.env.HOOPDATA_OWNER_COVERAGE_PREVIEW_ENABLED!=="true")notFound();
 await requireAmbassadorSession("/owner-hq/basketball-data/coverage",true);
 const params=await searchParams,side=params.side??"mens",after=params.after??null;
 if((side!=="mens"&&side!=="womens")||(after!==null&&(typeof after!=="string"||!uuid.test(after))))notFound();
 const data=await load(side,after);
 const base="/owner-hq/basketball-data/coverage";
 return <main className="page-shell"><div className="page-container" style={{display:"grid",gap:16,paddingBlock:24}}>
  <header className="hero-card"><p>Private owner workspace · Isolated preview</p><h1>League coverage audit</h1><p>Observations from stored records, not live provider health or a certification of complete coverage. Women's legacy directory entries are not counted as canonical league coverage.</p><Link href="/owner-hq/basketball-data" prefetch={false}>Back to Basketball Data Center</Link></header>
  <nav aria-label="Basketball side" className="actions"><Link className="btn" href={base+"?side=mens"} prefetch={false}>Men's leagues</Link><Link className="btn dark" href={base+"?side=womens"} prefetch={false}>Women's leagues</Link></nav>
  {!data?<section className="card"><h2>Coverage unavailable</h2><p>Isolated database or reviewed audit data is not available. No coverage numbers are inferred.</p></section>:<>
   <section className="card"><h2>Shared request budget</h2><p>Rolling reservation usage, not provider billing or confirmed upstream requests.</p>{data.quotas.length?data.quotas.map(q=><div key={q.pool}><h3>{q.pool}</h3><p>{q.enabled?"Enabled in isolated database":"Disabled"} · {q.minuteUsed}/{q.minuteLimit} reservations per rolling minute · {q.dayUsed}/{q.dayLimit} per rolling 24 hours</p>{q.cooldownActive?<p>Cooldown until {q.blockedUntil}</p>:null}</div>):<p>No quota pools configured.</p>}</section>
   <section className="card"><h2>{side==="mens"?"Men’s":"Women’s"} league observations</h2><p>{data.rows.length} leagues on this page. Fresh data does not establish complete schedules, official standings, or licensed mobile display.</p>
   {data.rows.length?<div role="region" aria-label="League coverage table" tabIndex={0} style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}><thead><tr>{["League","Current season","Fixtures","Standings"].map(h=><th key={h} scope="col" style={{padding:8}}>{h}</th>)}</tr></thead><tbody>{data.rows.map(r=><tr key={r.leagueId}><th scope="row" style={{padding:8}}>{r.name}{r.country?" · "+r.country:""}</th><td style={{padding:8}}>{r.season??"Unverified"}</td>{[r.fixtures,r.standings].map((e,i)=><td key={i} style={{padding:8}}>{labels[e.state]??"Unavailable"}{e.observedAt?<><br/>{e.observedAt} · {e.rowCount} rows</>:null}</td>)}</tr>)}</tbody></table></div>:<p>No active canonical leagues on this page.</p>}
   <div className="actions">{after?<Link href={base+"?side="+side} prefetch={false}>First page</Link>:null}{data.nextCursor?<Link href={base+"?side="+side+"&after="+data.nextCursor} prefetch={false}>Next page</Link>:null}</div></section>
  </>}
 </div></main>;
}
