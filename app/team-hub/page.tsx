"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import "../fan-feed/fan-feed.css";

type Team = { id:string; name:string; logo_url:string|null; league_name:string|null; country:string|null; city:string|null };
type Game = { id:string; team_id:string; opponent_name:string; status:string; scheduled_at:string|null; home_score:number|null; away_score:number|null; period_label:string|null; league_name:string|null };

export default function TeamHubPage(){
  const [loading,setLoading]=useState(true);
  const [signedIn,setSignedIn]=useState(false);
  const [teams,setTeams]=useState<Team[]>([]);
  const [games,setGames]=useState<Game[]>([]);
  const [message,setMessage]=useState("");
  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setSignedIn(false);setTeams([]);setGames([]);setLoading(false);return;}
    setSignedIn(true);
    const {data:follows,error}=await supabase.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","team").limit(100);
    if(error){setMessage(error.message);setLoading(false);return;}
    const ids=(follows||[]).map((x:any)=>x.target_id).filter(Boolean);
    if(!ids.length){setTeams([]);setGames([]);setLoading(false);return;}
    const [{data:teamRows},{data:gameRows}]=await Promise.all([
      supabase.from("teams").select("id,name,logo_url,league_name,country,city").in("id",ids).order("name",{ascending:true}),
      supabase.from("fan_live_games").select("id,team_id,opponent_name,status,scheduled_at,home_score,away_score,period_label,league_name").in("team_id",ids).in("status",["scheduled","live","in_progress"]).order("scheduled_at",{ascending:true}).limit(100)
    ]);
    setTeams((teamRows||[]) as Team[]);
    const now=Date.now();
    setGames(((gameRows||[]) as Game[]).filter(g=>["live","in_progress"].includes(g.status.toLowerCase())||(g.scheduled_at&&Date.parse(g.scheduled_at)>=now)));
    setLoading(false);
  },[]);
  useEffect(()=>{void load();const id=window.setInterval(()=>void load(),30000);return()=>window.clearInterval(id);},[load]);
  if(loading)return <main className="page-shell hc-fan-feed-page"><div className="page-container"><HoopLoading label="Loading your Team Hub…"/></div></main>;
  return <main className="page-shell hc-fan-feed-page"><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/teams">Discover teams</Link><Link href="/fan-feed">Fan HoopFeed</Link></nav></header>
    <section className="hero-card hc-feed-hero"><div><p className="eyebrow">FAN HQ · PERSONAL DASHBOARD</p><h1>Your Team Hub</h1><p className="muted">Your favorite teams, upcoming matchups, live scores and the latest fan conversations—all in one place.</p></div><p className="hc-feed-expiry-note">YOUR TEAMS<span>Scores and schedules refresh automatically.</span></p></section>
    {!signedIn&&<section className="dashboard-card hc-feed-empty"><h2>Sign in to see your teams</h2><p>Follow your favorite teams to build your personalized Team Hub.</p><Link className="btn" href="/login">Sign in</Link></section>}
    {signedIn&&!teams.length&&<section className="dashboard-card hc-feed-empty"><p className="eyebrow">START FOLLOWING</p><h2>Your Team Hub starts here.</h2><p>Follow teams to see upcoming games, live scores and team-tagged fan updates.</p><Link className="btn" href="/teams">Find teams</Link></section>}
    {!!message&&<p className="hc-feed-message" role="status">{message}</p>}
    <section style={{display:"grid",gap:16,marginTop:18}}>{teams.map(team=>{const teamGames=games.filter(g=>g.team_id===team.id).slice(0,3);return <article key={team.id} className="dashboard-card hc-feed-ticket" style={{padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}><span className="hc-live-team-logo">{team.logo_url?<img src={team.logo_url} alt="" onError={e=>{e.currentTarget.style.display="none";}}/>:null}<span className="hc-live-team-monogram">{team.name.split(/\\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}</span></span><div style={{minWidth:0,flex:1}}><h2 style={{margin:"0 0 4px"}}>{team.name}</h2><p className="muted" style={{margin:0}}>{[team.league_name,team.city,team.country].filter(Boolean).join(" · ")||"Basketball team"}</p></div><Link className="btn" href={`/teams/${team.id}`}>Team page</Link></div>
      <div style={{marginTop:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h3 style={{margin:0}}>Next games & live score</h3><Link href={`/teams/${team.id}`} style={{color:"var(--orange)",fontWeight:900}}>Team updates →</Link></div>
      {!teamGames.length?<p className="muted" style={{marginBottom:0}}>No upcoming game has been published yet.</p>:<div style={{display:"grid",gap:8,marginTop:10}}>{teamGames.map(game=><div key={game.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px",border:"1px solid var(--border)",borderRadius:12}}><div><strong>{["live","in_progress"].includes(game.status.toLowerCase())?"● LIVE NOW":"vs. "+game.opponent_name}</strong><p className="muted" style={{fontSize:12,margin:"4px 0 0"}}>{game.league_name||team.league_name||"Basketball"}{game.scheduled_at?" · "+new Date(game.scheduled_at).toLocaleString():""}{game.period_label?" · "+game.period_label:""}</p></div><strong style={{whiteSpace:"nowrap"}}>{game.home_score!=null&&game.away_score!=null?`${game.home_score} – ${game.away_score}`:"UP NEXT"}</strong></div>)}</div>}</div>
    </article>;})}</section>
  </div></main>;
}
