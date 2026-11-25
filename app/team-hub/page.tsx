"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import TeamLogo from "../../components/TeamLogo";
import TeamFanGroupEntry from "../../components/TeamFanGroupEntry";
import FanPredictionXp from "../../components/FanPredictionXp";
import FanBasketballSideSwitch, { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import { useLanguage } from "../../components/LanguageProvider";
import { teamHubCopy } from "./i18n";
import { getLiveGameStatusPresentation } from "../../lib/live-game-status";
import { formatPregameCountdown } from "../../lib/game-availability";
import "../fan-feed/fan-feed.css";

type Team = { id:string; name:string; logo_url:string|null; logo_bg?:"transparent"|"light"|"dark"|null; league_name:string|null; country:string|null; city:string|null };
type Game = { id:string; team_id:string; opponent_team_id:string|null; opponent_name:string; status:string; scheduled_at:string|null; started_at:string|null; ends_at:string|null; home_score:number|null; away_score:number|null; period_label:string|null; league_name:string|null };

export default function TeamHubPage(){
  const { language, formatDate, t } = useLanguage();
  const labels = teamHubCopy(language);
  const basketballSide = useFanBasketballSide();
  const [loading,setLoading]=useState(true);
  const [signedIn,setSignedIn]=useState(false);
  const [teams,setTeams]=useState<Team[]>([]);
  const [games,setGames]=useState<Game[]>([]);
  const [message,setMessage]=useState("");
  const [clock,setClock]=useState(()=>new Date());
  const [scheduleAvailable,setScheduleAvailable]=useState(false);
  const [teamNames,setTeamNames]=useState<Record<string,string>>({});
  const activeUser=useRef<string|null>(null);
  const requestSequence=useRef(0);

  const load=useCallback(async()=>{
    const requestId=++requestSequence.current;
    const current=()=>requestId===requestSequence.current;
    try {
      const {data:{user}}=await supabase.auth.getUser();
      if(!current())return;
      if(!user){activeUser.current=null;setSignedIn(false);setTeams([]);setGames([]);setTeamNames({});setScheduleAvailable(false);setMessage("");setLoading(false);return;}
      if(activeUser.current!==user.id){activeUser.current=user.id;setSignedIn(false);setTeams([]);setGames([]);setTeamNames({});setScheduleAvailable(false);}
      const {data:profile,error:profileError}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
      if(!current())return;
      if(profileError)throw profileError;
      if(profile?.account_type!=="fan"){setSignedIn(false);setTeams([]);setGames([]);setTeamNames({});setScheduleAvailable(false);window.location.replace("/dashboard");return;}
      setSignedIn(true);
      const {data:follows,error:followError}=await supabase.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","team").limit(100);
      if(!current())return;
      if(followError)throw followError;
      const ids=(follows||[]).map((x:any)=>x.target_id).filter(Boolean);
      if(!ids.length){setTeams([]);setGames([]);setTeamNames({});setScheduleAvailable(true);setMessage("");setLoading(false);return;}
      const teamQuery = basketballSide==="womens"
        ? await supabase.from("womens_teams").select("id,name,logo_url,logo_bg,league_name,country,city").in("id",ids).eq("active",true).order("name",{ascending:true})
        : await supabase.from("teams").select("id,name,logo_url,logo_bg,league_name,country,city").in("id",ids).eq("basketball_type","mens").eq("active",true).order("name",{ascending:true});
      if(!current())return;
      if(teamQuery.error)throw teamQuery.error;
      setTeams((teamQuery.data||[]) as Team[]);
      const followedTeamIds=(teamQuery.data||[]).map((team:any)=>team.id);
      setMessage("");
      if(followedTeamIds.length){
        const fields="id,team_id,opponent_team_id,opponent_name,status,scheduled_at,started_at,ends_at,home_score,away_score,period_label,league_name";
        const statuses=["scheduled","live","in_progress"];
        const cutoff=new Date(Date.now()-4*60*60_000).toISOString();
        const [homeRows,awayRows]=await Promise.all([
          supabase.from("fan_live_games").select(fields).in("team_id",followedTeamIds).in("status",statuses).gte("scheduled_at",cutoff).order("scheduled_at",{ascending:true}).limit(100),
          supabase.from("fan_live_games").select(fields).in("opponent_team_id",followedTeamIds).in("status",statuses).gte("scheduled_at",cutoff).order("scheduled_at",{ascending:true}).limit(100),
        ]);
        if(!current())return;
        if(homeRows.error||awayRows.error){setGames([]);setScheduleAvailable(false);setLoading(false);return;}
        const now=Date.now();
        const merged=Array.from(new Map([...(homeRows.data||[]),...(awayRows.data||[])].map(row=>[row.id,row as Game])).values())
          .filter(g=>["live","in_progress"].includes(g.status.toLowerCase())||Boolean(g.scheduled_at&&Date.parse(g.scheduled_at)>=now))
          .sort((a,b)=>Date.parse(a.scheduled_at||"")-Date.parse(b.scheduled_at||""));
        const homeIds=Array.from(new Set(merged.map(g=>g.team_id)));
        const names:Record<string,string>=Object.fromEntries((teamQuery.data||[]).map(team=>[team.id,team.name]));
        if(homeIds.length){
          const [mainNames,womensNames]=await Promise.all([
            supabase.from("teams").select("id,name").in("id",homeIds),
            basketballSide==="womens"?supabase.from("womens_teams").select("id,name").in("id",homeIds):Promise.resolve({data:[] as {id:string;name:string}[]}),
          ]);
          if(!current())return;
          for(const team of [...(mainNames.data||[]),...(womensNames.data||[])])names[team.id]=team.name;
        }
        setTeamNames(names);setGames(merged);setScheduleAvailable(true);
      } else {setGames([]);setTeamNames({});setScheduleAvailable(true);}
      setLoading(false);
    } catch(error) {
      if(current()){
        setTeams([]);setGames([]);setTeamNames({});setScheduleAvailable(false);
        setMessage("Could not load your Team Hub. Please try again.");
        setLoading(false);
      }
    }
  },[basketballSide]);

  useEffect(()=>{void load();const id=window.setInterval(()=>{setClock(new Date());void load();},30000);return()=>{window.clearInterval(id);requestSequence.current++;};},[load]);

  useEffect(()=>{
    let timer:number|undefined;
    const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{
      const next=session?.user.id||null;
      if(event!=="SIGNED_OUT"&&!(event==="SIGNED_IN"&&next!==activeUser.current))return;
      requestSequence.current++;activeUser.current=next;
      setSignedIn(false);setTeams([]);setGames([]);setTeamNames({});setScheduleAvailable(false);setMessage("");
      setLoading(Boolean(next));
      if(timer!==undefined)window.clearTimeout(timer);
      if(next)timer=window.setTimeout(()=>void load(),0);
    });
    return()=>{listener.subscription.unsubscribe();if(timer!==undefined)window.clearTimeout(timer);};
  },[load]);

  if(loading)return <main className="page-shell hc-fan-feed-page"><div className="page-container"><HoopLoading label={labels.loading}/></div></main>;
  const directoryHref=basketballSide==="womens"?"/womens":"/teams";
  return <main className="page-shell hc-fan-feed-page hc-role-hq"><div className="page-container">
    <section className="hero-card hc-feed-hero"><div><p className="eyebrow">{labels.kicker}</p><h1>{labels.title}</h1><p className="muted">{labels.description}</p></div><p className="hc-feed-expiry-note">{labels.yourTeams}<span>{labels.refreshNote}</span></p></section>
    {signedIn&&<FanBasketballSideSwitch lockedHint/>}
    {signedIn&&activeUser.current&&<FanPredictionXp key={activeUser.current} accountId={activeUser.current}/> }
    {!signedIn&&!message&&<section className="dashboard-card hc-feed-empty"><h2>{labels.signInTitle}</h2><p>{labels.signInBody}</p><Link className="btn" href="/login">{labels.signIn}</Link></section>}
    {signedIn&&!message&&!teams.length&&<section className="dashboard-card hc-feed-empty"><p className="eyebrow">{labels.startFollowing}</p><h2>{labels.emptyTitle}</h2><p>{labels.emptyBody}</p><Link className="btn" href={directoryHref}>{labels.findTeams}</Link></section>}
    {!!message&&<p className="hc-feed-message" role="status">{message}</p>}
    {signedIn&&<nav className="actions" aria-label={labels.title}><Link className="btn" href="/live-games">{labels.nextGames}</Link><Link className="btn" href="/feed">{labels.fanFeed}</Link><Link className="btn" href={directoryHref}>{labels.discover}</Link></nav>}
    <section style={{display:"grid",gap:16,marginTop:18}}>{signedIn&&teams.map(team=>{
      const teamGames=games.filter(g=>g.team_id===team.id||g.opponent_team_id===team.id).slice(0,3);
      const teamHref=(basketballSide==="womens"?"/womens/":"/teams/")+team.id;
      return <article key={team.id} className="dashboard-card hc-feed-ticket" style={{padding:20}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}><TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={52} className="hc-live-team-logo" /><div style={{minWidth:0,flex:1}}><h2 style={{margin:"0 0 4px"}}>{team.name}</h2><p className="muted" style={{margin:0}}>{[team.league_name,team.city,team.country].filter(Boolean).join(" · ")||labels.basketballTeam}</p></div><Link className="btn" href={teamHref}>{labels.teamPage}</Link></div>
        {basketballSide==="mens"&&<TeamFanGroupEntry teamId={team.id}/>}
        <div style={{marginTop:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h3 style={{margin:0}}>{labels.nextGames}</h3><Link href={teamHref} style={{color:"var(--orange)",fontWeight:900}}>{labels.teamUpdates} →</Link></div>
        {!scheduleAvailable?<p className="muted" role="status">Game schedules are temporarily unavailable.</p>:!teamGames.length?<p className="muted" style={{marginBottom:0}}>{labels.noGames}</p>:<div style={{display:"grid",gap:8,marginTop:10}}>{teamGames.map(game=>{const presentation=getLiveGameStatusPresentation(game,clock);const countdown=formatPregameCountdown(game.status,game.scheduled_at,clock);const opponent=game.team_id===team.id?game.opponent_name:teamNames[game.team_id]||labels.basketballTeam;return <div key={game.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px",border:"1px solid var(--border)",borderRadius:12}}><div><strong>{presentation.isVerifiedLive?"● "+labels.liveNow:presentation.isUnverified?presentation.label:labels.versus+" "+opponent}</strong><p className="muted" style={{fontSize:12,margin:"4px 0 0"}}>{game.league_name||team.league_name||t("basketball")}{game.scheduled_at?" · "+formatDate(game.scheduled_at,{dateStyle:"medium",timeStyle:"short"}):""}{presentation.showPeriod&&game.period_label?" · "+game.period_label:""}</p>{countdown&&<small>{countdown}</small>}</div><strong style={{whiteSpace:"nowrap"}}>{game.home_score!=null&&game.away_score!=null?String(game.team_id===team.id?game.home_score:game.away_score)+" – "+String(game.team_id===team.id?game.away_score:game.home_score):presentation.isUnverified?"—":labels.upNext}</strong></div>})}</div>}</div>
      </article>;
    })}</section>
  </div></main>;
}
