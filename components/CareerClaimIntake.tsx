"use client";
import { useEffect,useRef,useState } from "react";
import {supabase} from "../lib/supabase";
import {parseCareerSeason} from "../lib/career/claim-input";

type Club={id:string;team_id:string|null;womens_team_id:string|null;historical_name:string;historical_league:string;historical_division:string|null;historical_country:string;club_state:string};
type Saved={id:string;season_start_year:number;season_end_year:number;verification_status:string;team_id:string|null;womens_team_id:string|null};
type Missing={id:string;historical_name:string;season_start_year:number;season_end_year:number;status:string};
type History={claims:Saved[];missingClubs:Missing[];hasMore:boolean};
export const careerIntakeEnabled=process.env.NEXT_PUBLIC_HOOPCHECK_CAREER_CLAIMS_ENABLED==="true";

export default function CareerClaimIntake({userId,initialCategory="mens"}:{userId:string;initialCategory?:"mens"|"womens"}){
 const [name,setName]=useState(""),[season,setSeason]=useState(""),[category,setCategory]=useState(initialCategory);
 const [country,setCountry]=useState(""),[city,setCity]=useState(""),[league,setLeague]=useState(""),[division,setDivision]=useState("");
 const [results,setResults]=useState<Club[]>([]),[searched,setSearched]=useState(false),[more,setMore]=useState(false),[missing,setMissing]=useState(false);
 const [history,setHistory]=useState<History|null>(null),[historyError,setHistoryError]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const active=useRef(true),lock=useRef(false),sessionVersion=useRef(0);
 const [sessionInvalidated,setSessionInvalidated]=useState(false);
 async function api(path:string,method="GET",body?:object){
  const version=sessionVersion.current;
  const {data:{session}}=await supabase.auth.getSession();
  if(!active.current||version!==sessionVersion.current||session?.user.id!==userId)throw Error("Your session changed. Reopen career history.");
  const response=await fetch("/api/career/"+path,{method,cache:"no-store",headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  const {data:{session:after}}=await supabase.auth.getSession();
  if(!active.current||version!==sessionVersion.current||after?.user.id!==userId)throw Error("Your session changed.");
  if(!response.ok)throw Error(typeof data.error==="string"?data.error:"Career history is unavailable.");
  return data;
 }
 async function refresh(){
  try{const data=await api("claims");if(active.current){setHistory(data as History);setHistoryError("");}}
  catch{if(active.current){setHistory(null);setHistoryError("Saved career history could not load.");}}
 }
 useEffect(()=>{
  active.current=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
   if(session?.user.id!==userId){active.current=false;sessionVersion.current++;setSessionInvalidated(true);setHistory(null);setResults([]);setSearched(false);setMore(false);setMissing(false);setName("");setSeason("");setCountry("");setCity("");setLeague("");setDivision("");setCategory(initialCategory);setMessage("");setError("");setHistoryError("");setBusy(false);}
  });
  void refresh();
  return()=>{active.current=false;sessionVersion.current++;subscription.unsubscribe();};
 // remount by user ID at callers; the session check also fails closed.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[userId]);
 function resetSearch(){setResults([]);setSearched(false);setMore(false);setMessage("");setError("");}
 async function perform(action:()=>Promise<void>){
  if(lock.current)return;if(!active.current)return;lock.current=true;setBusy(true);setError("");setMessage("");
  try{await action();}catch(e){if(active.current)setError(e instanceof Error?e.message:"Unable to complete the request.");}
  finally{lock.current=false;if(active.current)setBusy(false);}
 }
 async function search(){
  if(!parseCareerSeason(season,new Date().getUTCFullYear())){setError("Enter one season, for example 2023-24 or 2024.");return;}
  await perform(async()=>{setResults([]);setSearched(false);const data=await api("historical-clubs?"+new URLSearchParams({q:name,season,basketballType:category}));setResults(data.results);setMore(Boolean(data.hasMore));setSearched(true);});
 }
 async function save(body:object){
  await perform(async()=>{await api("claims","POST",body);setMessage("Saved privately. Verification is pending; this does not unlock reviews yet.");await refresh();});
 }
 function seasonLabel(row:{season_start_year:number;season_end_year:number}){return row.season_start_year===row.season_end_year?String(row.season_start_year):row.season_start_year+"–"+row.season_end_year;}
 if(sessionInvalidated)return <p role="alert">Your session changed. Reopen career history.</p>;
 return <section aria-label="Private career history">
  <p className="muted">Add teams you played for, including clubs that changed names or divisions, or stopped operating. Career claims are private until separately verified.</p>
  <fieldset disabled={busy}>
   <legend>Find a team for one season</legend>
   <label>Basketball category<select value={category} onChange={e=>{setCategory(e.target.value==="womens"?"womens":"mens");resetSearch();}}><option value="mens">Men’s</option><option value="womens">Women’s</option></select></label>
   <label>Team name at the time<input value={name} maxLength={160} onChange={e=>{setName(e.target.value);resetSearch();}}/></label>
   <label>Season<input value={season} maxLength={24} placeholder="2023-24" onChange={e=>{setSeason(e.target.value);resetSearch();}}/></label>
   <button className="btn" type="button" onClick={()=>void search()} disabled={name.trim().length<2||!season.trim()}>Search historical teams</button>
   {searched&&<div aria-live="polite">{results.length?results.map(row=><div key={row.id}><strong>{row.historical_name}</strong><p className="muted">{[row.historical_league,row.historical_division,row.historical_country,row.club_state==="archived"?"Archived":row.club_state==="renamed"?"Renamed":""].filter(Boolean).join(" · ")}</p><button className="btn dark" type="button" onClick={()=>void save({kind:"claim",id:row.team_id||row.womens_team_id,source:row.team_id?"teams":"womens_teams",season})}>Add pending claim</button></div>):<p>No historical match. You can request the missing club below.</p>}{more&&<p>More matches exist. Refine the team name.</p>}</div>}
   <button className="btn dark" type="button" aria-expanded={missing} onClick={()=>setMissing(v=>!v)}> {missing?"Hide missing club request":"Team not listed? Request a club"}</button>
   {missing&&<div><label>Country<input value={country} maxLength={100} onChange={e=>setCountry(e.target.value)}/></label><label>City (optional)<input value={city} maxLength={100} onChange={e=>setCity(e.target.value)}/></label><label>League at the time<input value={league} maxLength={160} onChange={e=>setLeague(e.target.value)}/></label><label>Division (optional)<input value={division} maxLength={100} onChange={e=>setDivision(e.target.value)}/></label><button className="btn" type="button" disabled={!name.trim()||!country.trim()||!league.trim()||!season.trim()} onClick={()=>void save({kind:"missing_club",name,country,city,league,division,basketballType:category,season})}>Request historical club</button></div>}
  </fieldset>
  {busy&&<p role="status">Working…</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <h2>Saved career claims</h2>
  {historyError&&<><p role="alert">{historyError}</p><button className="btn dark" type="button" onClick={()=>void refresh()}>Retry history</button></>}
  {history&&<>{!history.claims.length&&!history.missingClubs.length&&<p>No claims yet.</p>}{history.claims.map(row=><p key={row.id}>{seasonLabel(row)} · {row.womens_team_id?"Women’s":"Men’s"} team · {row.verification_status}</p>)}{history.missingClubs.map(row=><p key={row.id}>{row.historical_name} · {seasonLabel(row)} · {row.status}</p>)}{history.hasMore&&<p>Showing the most recent claims and requests.</p>}</>}
 </section>;
}
