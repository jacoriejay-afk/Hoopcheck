"use client";
import { useEffect,useRef,useState } from "react";
import { supabase } from "../lib/supabase";
type Club={id:string;name:string;league_id:string;basketball_type:string};
type Opponent={id:string;name:string};
type Proposal={id:string;kind:"schedule"|"result";scheduled_at:string;opponent_team_id:string;team_score:number|null;opponent_score:number|null;status:"pending"|"approved"|"rejected";review_note:string|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default function ManagerGameSubmissions({teamId}:{teamId:string}){
 const [club,setClub]=useState<Club|null>(null),[opponents,setOpponents]=useState<Opponent[]>([]),[history,setHistory]=useState<Proposal[]>([]);
 const [loading,setLoading]=useState(true),[message,setMessage]=useState(""),[refresh,setRefresh]=useState(0),[submitting,setSubmitting]=useState(false);
 const [kind,setKind]=useState<"schedule"|"result">("schedule"),[opponent,setOpponent]=useState(""),[tip,setTip]=useState(""),[score,setScore]=useState(""),[otherScore,setOtherScore]=useState(""),[evidence,setEvidence]=useState("");
 const owner=useRef<string|null>(null),attempt=useRef<{fingerprint:string;id:string}|null>(null),inFlight=useRef<AbortController|null>(null);
 const [limited,setLimited]=useState(false);
 useEffect(()=>{
  let alive=true;const ctl=new AbortController();let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;ctl.abort();if(alive){setLoading(false);setMessage("Could not verify club access. Retry.");}},12000);
  setLoading(true);setMessage("");setClub(null);setOpponents([]);setHistory([]);
  const auth=supabase.auth.onAuthStateChange((_event,session)=>{
   if(owner.current&&owner.current!==session?.user.id){owner.current=null;inFlight.current?.abort();inFlight.current=null;attempt.current=null;ctl.abort();setClub(null);setHistory([]);setOpponents([]);setEvidence("");setLoading(false);setSubmitting(false);setMessage("Session changed. Sign in and retry.");}
  });
  void(async()=>{
   try{
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(!alive||ctl.signal.aborted)return;
    if(userError||!user)throw Error("Sign in with an isolated verified manager account.");
    owner.current=user.id;
    const [profile,claim,team]=await Promise.all([
     supabase.from("profiles").select("account_type").eq("id",user.id).abortSignal(ctl.signal).maybeSingle(),
     supabase.from("profile_claim_requests").select("id").eq("requester_id",user.id).eq("entity_type","team").eq("entity_id",teamId).eq("status","approved").limit(1).abortSignal(ctl.signal),
     supabase.from("teams").select("id,name,league_id,basketball_type").eq("id",teamId).eq("active",true).abortSignal(ctl.signal).maybeSingle()
    ]);
    if(!alive||ctl.signal.aborted)return;
    const t=team.data as Club|null;
    if(profile.error||claim.error||team.error||!["manager","club_admin"].includes(profile.data?.account_type??"")||!claim.data?.length||!t||!uuid.test(t.league_id)||!["mens","womens"].includes(t.basketball_type))throw Error("An active approved manager claim and same-side league are required.");
    const [op,rows]=await Promise.all([
     supabase.from("teams").select("id,name").eq("league_id",t.league_id).eq("basketball_type",t.basketball_type).eq("active",true).neq("id",t.id).order("name").order("id").limit(101).abortSignal(ctl.signal),
     supabase.from("hoopdata_manager_submissions").select("id,kind,scheduled_at,opponent_team_id,team_score,opponent_score,status,review_note").eq("submitted_by",user.id).eq("team_id",teamId).order("submitted_at",{ascending:false}).limit(25).abortSignal(ctl.signal)
    ]);
    if(!alive||ctl.signal.aborted||owner.current!==user.id)return;
    if(op.error||rows.error)throw Error("Game proposals are not available in this isolated database.");
    setClub(t);setLimited((op.data??[]).length>100);setOpponents((op.data??[]).slice(0,100));setHistory((rows.data??[]) as Proposal[]);
   }catch(e){if(alive&&!ctl.signal.aborted)setMessage(e instanceof Error?e.message:"Could not verify club access.");}
   finally{clearTimeout(timer);if(alive&&(!ctl.signal.aborted||timedOut))setLoading(false);}
  })();
  return()=>{alive=false;clearTimeout(timer);ctl.abort();auth.data.subscription.unsubscribe();inFlight.current?.abort();inFlight.current=null;};
 },[teamId,refresh]);
 async function submit(){
  if(!club||!owner.current||inFlight.current||!opponents.some(t=>t.id===opponent)||!evidence.trim()||evidence.trim().length>2000||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tip))return;
  const parsed=new Date(tip+":00Z");
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,16)!==tip){setMessage("Enter a valid UTC date and time.");return;}
  const a=kind==="result"&&/^\d{1,3}$/.test(score)?Number(score):null,b=kind==="result"&&/^\d{1,3}$/.test(otherScore)?Number(otherScore):null;
  if(kind==="result"&&(a===null||b===null||a>300||b>300||a===b)){setMessage("Enter both final scores (0–300, not tied).");return;}
  const payload={p_team:club.id,p_opponent:opponent,p_league:club.league_id,p_tipoff:parsed.toISOString(),p_kind:kind,p_team_score:a,p_opponent_score:b,p_evidence:evidence.trim()};
  const fingerprint=JSON.stringify(payload);
  if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,id:crypto.randomUUID()};
  const requestId=attempt.current.id,uid=owner.current,ctl=new AbortController();inFlight.current=ctl;setSubmitting(true);setMessage("");
  const timer=setTimeout(()=>{ctl.abort();if(inFlight.current===ctl){inFlight.current=null;setSubmitting(false);setMessage("Submission could not be confirmed. Retry unchanged to check the same request.");}},12000);
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||user?.id!==uid||owner.current!==uid||ctl.signal.aborted)throw Error("Session unavailable");
   const {data,error}=await supabase.rpc("hoopdata_submit_manager_game",{...payload,p_request:requestId}).abortSignal(ctl.signal);
   if(owner.current!==uid||inFlight.current!==ctl)return;
   if(error||!data||!uuid.test(data.id)||!["pending","approved","rejected"].includes(data.status))throw Error("Proposal not confirmed");
   attempt.current=null;setEvidence("");setTip("");setScore("");setOtherScore("");setOpponent("");
   setMessage(data.status==="pending"?"Proposal recorded for independent review. Official scores are unchanged.":"This proposal has already been reviewed.");
   const result=await supabase.from("hoopdata_manager_submissions").select("id,kind,scheduled_at,opponent_team_id,team_score,opponent_score,status,review_note").eq("submitted_by",uid).eq("team_id",teamId).order("submitted_at",{ascending:false}).limit(25).abortSignal(ctl.signal);
   if(inFlight.current===ctl&&owner.current===uid&&!result.error)setHistory((result.data??[]) as Proposal[]);
  }catch{if(inFlight.current===ctl&&owner.current===uid)setMessage("Submission could not be confirmed. Retry unchanged to check the same request; official scores are unchanged.");}
  finally{clearTimeout(timer);if(inFlight.current===ctl){inFlight.current=null;setSubmitting(false);}}
 }
 if(loading)return <p role="status">Checking verified club access…</p>;
 if(!club)return <section className="card"><p role="status">{message||"Verified manager access unavailable."}</p><button className="btn" onClick={()=>setRefresh(n=>n+1)}>Retry</button></section>;
 return <div style={{display:"grid",gap:16}}>
  <section className="card"><h2>{club.name}</h2><p>Same-league fixtures only. All information requires independent review.</p>
   <form style={{display:"grid",gap:12}} onSubmit={e=>{e.preventDefault();void submit();}}>
    <label>Proposal type<select value={kind} onChange={e=>setKind(e.target.value==="result"?"result":"schedule")} disabled={submitting}><option value="schedule">Schedule</option><option value="result">Final result</option></select></label>
    <label>Opponent<select value={opponent} onChange={e=>setOpponent(e.target.value)} required disabled={submitting}><option value="">Select verified league opponent</option>{opponents.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    {limited?<p>Showing first 100 active opponents. If your opponent is not listed, request directory review.</p>:null}
    <label>Scheduled tipoff (UTC)<input type="datetime-local" value={tip} required onChange={e=>setTip(e.target.value)} disabled={submitting}/></label>
    {kind==="result"?<><label>Our final score<input type="number" min="0" max="300" step="1" value={score} onChange={e=>setScore(e.target.value)} required disabled={submitting}/></label><label>Opponent final score<input type="number" min="0" max="300" step="1" value={otherScore} onChange={e=>setOtherScore(e.target.value)} required disabled={submitting}/></label></>:null}
    <label>Official evidence reference<textarea value={evidence} onChange={e=>setEvidence(e.target.value)} required maxLength={2000} rows={3} disabled={submitting}/></label>
    <p>Use a public official league or club reference. Do not include private contact details or player documents.</p>
    <button type="submit" className="btn" disabled={submitting||!opponent||!tip||!evidence.trim()}>{submitting?"Submitting…":"Submit for review"}</button>
   </form><p role="status">{message}</p>
  </section>
  <section className="card"><h2>My latest proposals</h2>{history.length?history.map(r=><article key={r.id} style={{paddingBlock:12,borderBottom:"1px solid var(--border)"}}><strong>{r.kind==="result"?"Result":"Schedule"} · {r.status}</strong><p>{opponents.find(o=>o.id===r.opponent_team_id)?.name||"Recorded opponent"} · {new Date(r.scheduled_at).toLocaleString()}</p>{r.kind==="result"?<p>{r.team_score??"—"} – {r.opponent_score??"—"}</p>:null}{r.review_note?<p>{r.review_note}</p>:null}</article>):<p>No proposals recorded yet.</p>}</section>
 </div>;
}
