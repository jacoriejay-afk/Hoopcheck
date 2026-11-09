"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import TeamLogo from "../../components/TeamLogo";
import TeamFanGroupEntry from "../../components/TeamFanGroupEntry";
import FanBasketballSideSwitch, { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import { useLanguage } from "../../components/LanguageProvider";
import { teamHubCopy } from "./i18n";
import "../fan-feed/fan-feed.css";

type Team = { id:string; name:string; logo_url:string|null; logo_bg?:"transparent"|"light"|"dark"|null; league_name:string|null; country:string|null; city:string|null };
type Game = { id:string; team_id:string; opponent_name:string; status:string; scheduled_at:string|null; home_score:number|null; away_score:number|null; period_label:string|null; league_name:string|null };

export default function TeamHubPage(){
  const { language, formatDate, t } = useLanguage();
  const labels = teamHubCopy(language);
  const basketballSide = useFanBasketballSide();
  const [loading,setLoading]=useState(true);
  const [signedIn,setSignedIn]=useState(false);
  const [teams,setTeams]=useState<Team[]>([]);
  const [games,setGames]=useState<Game[]>([]);
  const [message,setMessage]=useState("");
  const requestSequence=useRef(0);

  const load=useCallback(async()=>{
    const requestId=++requestSequence.current;
    const current=()=>requestId===requestSequence.current;
    try {
      const {data:{user}}=await supabase.auth.getUser();
      if(!current())return;
      if(!user){setSignedIn(false);setTeams([]);setGames([]);setLoading(false);return;}
      const {data:profile,error:profileError}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
      if(!current())return;
      if(profileError)throw profileError;
      if(profile?.account_type!=="fan"){window.location.replace("/dashboard");return;}
      setSignedIn(true);
      const {data:follows,error:followError}=await supabase.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","team").limit(100);
      if(!current())return;
      if(followError)throw followError;
      const ids=(follows||[]).map((x:any)=>x.target_id).filter(Boolean);
      if(!ids.length){setTeams([]);setGames([]);setLoading(false);return;}
      const teamQuery = basketballSide==="womens"
        ? await supabase.from("womens_teams").select("id,name,logo_url,logo_bg,league_name,country,city").in("id",ids).eq("active",true).order("name",{ascending:true})
        : await supabase.from("teams").select("id,name,logo_url,logo_bg,league_name,country,city").in("id",ids).eq("basketball_type","mens").eq("active",true).order("name",{ascending:true});
      if(!current())return;
      if(teamQuery.error)throw teamQuery.error;
      setTeams((teamQuery.data||[]) as Team[]);
      const followedTeamIds=(teamQuery.data||[]).map((team:any)=>team.id);
      setMessage("");
      if(basketballSide==="mens" && followedTeamIds.length){
        const {data:gameRows,error:gameError}=await supabase.from("fan_live_games").select("id,team_id,opponent_name,status,scheduled_at,home_score,away_score,period_label,league_name").in("team_id",followedTeamIds).in("status",["scheduled","live","in_progress"]).order("scheduled_at",{ascending:true}).limit(100);
        if(!current())return;
        if(gameError)throw gameError;
        const now=Date.now();
        setGames(((gameRows||[]) as Game[]).filter(g=>["live","in_progress"].includes(g.status.toLowerCase())||(g.scheduled_at&&Date.parse(g.scheduled_at)>=now)));
      } else setGames([]);
      setLoading(false);
    } catch(error) {
      if(current()){
        setMessage(error instanceof Error?error.message:"Could not load your Team Hub.");
        setLoading(false);
      }
    }
  },[basketballSide]);

  useEffect(()=>{void load();const id=window.setInterval(()=>void load(),30000);return()=>window.clearInterval(id);},[load]);

  if(loading)return <main className="page-shell hc-fan-feed-page"><div className="page-container"><HoopLoading label={labels.loading}/></div></main>;
  const directoryHref=basketballSide==="womens"?"/womens":"/teams";
  return <main className="page-shell hc-fan-feed-page"><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href={directoryHref}>{labels.discover}</Link><Link href="/fan-feed">{labels.fanFeed}</Link></nav></header>
    <section className="hero-card hc-feed-hero"><div><p className="eyebrow">{labels.kicker}</p><h1>{labels.title}</h1><p className="muted">{labels.description}</p><div style={{marginTop:12}}><FanBasketballSideSwitch /></div></div><p className="hc-feed-expiry-note">{labels.yourTeams}<span>{labels.refreshNote}</span></p></section>
    {!signedIn&&<section className="dashboard-card hc-feed-empty"><h2>{labels.signInTitle}</h2><p>{labels.signInBody}</p><Link className="btn" href="/login">{labels.signIn}</Link></section>}
    {signedIn&&!teams.length&&<section className="dashboard-card hc-feed-empty"><p className="eyebrow">{labels.startFollowing}</p><h2>{labels.emptyTitle}</h2><p>{labels.emptyBody}</p><Link className="btn" href={directoryHref}>{labels.findTeams}</Link></section>}
    {!!message&&<p className="hc-feed-message" role="status">{message}</p>}
    <section style={{display:"grid",gap:16,marginTop:18}}>{teams.map(team=>{
      const teamGames=games.filter(g=>g.team_id===team.id).slice(0,3);
      const teamHref=(basketballSide==="womens"?"/womens/":"/teams/")+team.id;
      return <article key={team.id} className="dashboard-card hc-feed-ticket" style={{padding:20}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}><TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={52} className="hc-live-team-logo" /><div style={{minWidth:0,flex:1}}><h2 style={{margin:"0 0 4px"}}>{team.name}</h2><p className="muted" style={{margin:0}}>{[team.league_name,team.city,team.country].filter(Boolean).join(" · ")||labels.basketballTeam}</p></div><Link className="btn" href={teamHref}>{labels.teamPage}</Link></div>
        {basketballSide==="mens"&&<TeamFanGroupEntry teamId={team.id}/>}
        <div style={{marginTop:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h3 style={{margin:0}}>{labels.nextGames}</h3><Link href={teamHref} style={{color:"var(--orange)",fontWeight:900}}>{labels.teamUpdates} →</Link></div>
        {basketballSide==="womens"?<p className="muted" style={{marginBottom:0}}>{labels.womensScheduleUnavailable}</p>:!teamGames.length?<p className="muted" style={{marginBottom:0}}>{labels.noGames}</p>:<div style={{display:"grid",gap:8,marginTop:10}}>{teamGames.map(game=><div key={game.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px",border:"1px solid var(--border)",borderRadius:12}}><div><strong>{["live","in_progress"].includes(game.status.toLowerCase())?"● "+labels.liveNow:labels.versus+" "+game.opponent_name}</strong><p className="muted" style={{fontSize:12,margin:"4px 0 0"}}>{game.league_name||team.league_name||t("basketball")}{game.scheduled_at?" · "+formatDate(game.scheduled_at,{dateStyle:"medium",timeStyle:"short"}):""}{game.period_label?" · "+game.period_label:""}</p></div><strong style={{whiteSpace:"nowrap"}}>{game.home_score!=null&&game.away_score!=null?String(game.home_score)+" – "+String(game.away_score):labels.upNext}</strong></div>)}</div>}</div>
      </article>;
    })}</section>
  </div></main>;
}
