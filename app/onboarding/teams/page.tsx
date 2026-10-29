"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchBar from "../../../components/SearchBar";
import TeamLogo from "../../../components/TeamLogo";
import { supabase } from "../../../lib/supabase";

type Team = { id:string; name:string; country:string|null; city?:string|null; league_name:string|null; logo_url?:string|null; logo_bg?:"transparent"|"light"|"dark"|null; logo?:string|null };
type Follow = { target_id:string; target_type:string };

export default function TeamOnboardingPage() {
  const router = useRouter();
  const [step,setStep] = useState(1);
  const [teams,setTeams] = useState<Team[]>([]);
  const [userId,setUserId] = useState("");
  const [accountType,setAccountType] = useState("fan");
  const [query,setQuery] = useState("");
  const [myTeams,setMyTeams] = useState<string[]>([]);
  const [watching,setWatching] = useState<string[]>([]);
  const [followed,setFollowed] = useState<string[]>([]);
  const [loading,setLoading] = useState(true);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState<string|null>(null);

  useEffect(()=>{ let alive=true; void (async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/login?next=/onboarding/teams");return;}
    if(!alive)return; setUserId(user.id);
    const [{data:profile},{data:teamRows},{data:follows}] = await Promise.all([
      supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle(),
      supabase.from("teams").select("id,name,country,city,league_name,logo_url,logo_bg").eq("active",true).order("name").limit(1500),
      supabase.from("follow_relationships").select("target_id,target_type").eq("follower_id",user.id).eq("target_type","team")
    ]);
    if(!alive)return; setAccountType(profile?.account_type||"fan"); setTeams((teamRows||[]) as Team[]);
    setFollowed((follows||[]).map((x:Follow)=>x.target_id)); setLoading(false);
  })(); return ()=>{alive=false}; },[router]);

  const filtered = useMemo(()=>{const q=query.trim().toLowerCase();return teams.filter(t=>!q||[t.name,t.country,t.league_name,t.city].some(v=>v?.toLowerCase().includes(q))).slice(0,8)},[teams,query]);
  const suggested = useMemo(()=>{
    const countries=new Set(teams.filter(t=>myTeams.includes(t.id)||watching.includes(t.id)).map(t=>t.country).filter(Boolean));
    const related=teams.filter(t=>!myTeams.includes(t.id)&&!watching.includes(t.id)&&!followed.includes(t.id)&&countries.has(t.country));
    const global=teams.filter(t=>!myTeams.includes(t.id)&&!watching.includes(t.id)&&!followed.includes(t.id));
    return [...related,...global].slice(0,12);
  },[teams,myTeams,watching,followed]);

  const saveFollow = useCallback(async (team:Team, alerts:boolean) => {
    if(!userId)return;
    setBusy(team.id); setMessage("");
    try {
      const {error}=await supabase.from("follow_relationships").upsert(
        {follower_id:userId,target_id:team.id,target_type:"team",notify_reviews:alerts},
        {onConflict:"follower_id,target_type,target_id"}
      );
      if(error)throw error;
      setFollowed(current=>current.includes(team.id)?current:[...current,team.id]);
      setMessage(alerts?"Following team — review alerts enabled.":"Team followed.");
    } catch(e) {
      // Compatibility fallback for schemas whose follow table stores alerts separately.
      try {
        const {error}=await supabase.from("follow_relationships").insert({follower_id:userId,target_id:team.id,target_type:"team"});
        if(error)throw error; setFollowed(current=>current.includes(team.id)?current:[...current,team.id]);
        setMessage("Team followed.");
      } catch(err) { setMessage(err instanceof Error?err.message:(e instanceof Error?e.message:"Could not follow this team. Please try again.")); }
    } finally {setBusy(null);}
  },[userId]);

  async function chooseCareerTeam(team:Team) {
    if(myTeams.includes(team.id)) {setMyTeams(v=>v.filter(id=>id!==team.id));return;}
    setMyTeams(v=>[...v,team.id]); await saveFollow(team,false);
    if(accountType==="player") {
      const {error}=await supabase.from("player_team_affiliations").upsert(
        {user_id:userId,team_id:team.id,relationship:"former",verified:false},
        {onConflict:"user_id,team_id"}
      );
      if(error) setMessage("Team followed, but career history needs a retry: "+error.message);
    }
  }
  async function chooseWatchingTeam(team:Team) {
    if(watching.includes(team.id)){setWatching(v=>v.filter(id=>id!==team.id));return;}
    setWatching(v=>[...v,team.id]); await saveFollow(team,true);
  }
  async function finish() {
    try {await supabase.from("profiles").update({onboarding_completed:true}).eq("id",userId);} catch {}
    localStorage.setItem("hoopcheck_team_onboarding","complete"); router.replace("/dashboard");
  }
  function skip(){void finish();}
  const selected = step===1?myTeams:watching;
  const chosenTeams = teams.filter(t=>selected.includes(t.id));
  const title=step===1?"Which teams have you played for?":step===2?"Thinking about signing somewhere?":"Suggested for you";
  if(loading)return <main className="page-shell"><div className="page-container"><section className="dashboard-card">Loading your team directory…</section></div></main>;

  return <main className="page-shell hc-onboarding"><div className="page-container">
    <header className="hc-onboarding-header"><Link href="/dashboard" className="hc-onboarding-skip" onClick={e=>{e.preventDefault();skip();}}>Skip setup</Link><span className="eyebrow">PERSONALIZE HOOPCHECK</span><div className="hc-progress-label">Step {step} of 3</div><div className="hc-progress"><span style={{width:`${step/3*100}%`}}/></div></header>
    <section className="hc-onboarding-panel"><p className="eyebrow">{step===1?"YOUR TEAMS":step===2?"TEAMS YOU’RE WATCHING":"SUGGESTED FOR YOU"}</p><h1>{title}</h1>
      {step===1&&<p className="muted">Your reviews of these teams help the next player.</p>}
      {step===2&&<p className="muted">Follow teams you’re considering. We’ll turn on alerts for new reviews.</p>}
      {step<3&&<><SearchBar value={query} onChange={setQuery} placeholder="Search teams by name, league, or country" ariaLabel="Search teams" buttonLabel="Search" onSubmit={setQuery}/><div className="hc-team-results">{filtered.map(team=><button key={team.id} type="button" className={selected.includes(team.id)?"hc-team-result selected":"hc-team-result"} onClick={()=>void (step===1?chooseCareerTeam(team):chooseWatchingTeam(team))}><TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={44} className="hc-team-logo" /><span className="hc-team-info"><strong>{team.name}</strong><small>{team.league_name||"League not listed"} · {team.country||"Country not listed"}</small></span><span className="hc-team-add">{selected.includes(team.id)?"✓":"+"}</span></button>)}</div><p className="hc-request-team">Can’t find your team? <Link href="/support?topic=team-request">Request a team</Link></p>
      <div className="hc-selected"><strong>{step===1?"My teams":"Teams I’m watching"} · {chosenTeams.length}</strong><div className="hc-chips">{chosenTeams.map(team=><button type="button" key={team.id} className="hc-chip" onClick={()=>void (step===1?chooseCareerTeam(team):chooseWatchingTeam(team))}>{team.name} <span aria-hidden="true">×</span></button>)}</div></div></>}
      {step===3&&<><p className="muted">Based on your picks and what the HoopCheck community follows and reviews. Following updates here without leaving this step.</p><div className="hc-suggested-grid">{suggested.map(team=><article key={team.id} className="hc-suggested-card"><TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={44} className="hc-team-logo" /><strong>{team.name}</strong><small>{team.league_name||"Basketball"} · {team.country||"Global"}</small><button type="button" className={followed.includes(team.id)?"btn dark":"btn"} disabled={busy===team.id||followed.includes(team.id)} onClick={()=>void saveFollow(team,false)}>{busy===team.id?"Following…":followed.includes(team.id)?"Following":"Follow"}</button></article>)}</div><p className="hc-request-team">Can’t find your team? <Link href="/support?topic=team-request">Request a team</Link></p></>}
      <footer className="hc-onboarding-actions"><button type="button" className="btn dark" onClick={skip}>Skip</button>{step>1&&<button type="button" className="btn dark" onClick={()=>setStep(s=>s-1)}>Back</button>}<button type="button" className="btn" onClick={()=>step<3?setStep(s=>s+1):void finish()}>{step===3?"Finish": "Continue"}</button></footer>
      {message&&<p role="status" aria-live="polite" className="muted hc-onboarding-message">{message}</p>}
    </section>
  </div></main>;
}
