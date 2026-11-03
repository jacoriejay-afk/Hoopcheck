"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCachedSession, supabase } from "../lib/supabase";
import CategoryTile, { type CategoryTileKind } from "../components/CategoryTile";
import SearchBar from "../components/SearchBar";
import TeamLogo from "../components/TeamLogo";
import { HoopIcon } from "../components/HoopCheckUI";

const categories:{label:string;subtitle:string;href:string;category:CategoryTileKind;type:string}[]=[
 {label:"Men’s Teams",subtitle:"Research teams before you sign",href:"/teams",category:"teams",type:"mens-teams"},
 {label:"Women’s Teams",subtitle:"Explore women’s basketball",href:"/womens",category:"womens",type:"womens-teams"},
 {label:"Coaches",subtitle:"Check coaching reputations",href:"/coaches",category:"coaches",type:"coaches"},
 {label:"Leagues",subtitle:"Compare competitions",href:"/leagues",category:"leagues",type:"leagues"},
 {label:"Players",subtitle:"Discover basketball players",href:"/players",category:"players",type:"players"}
];
type Team={id:string;name:string;country:string|null;league_name:string|null;logo_url:string|null;logo_bg:"transparent"|"light"|"dark"|null};
type Game={id:string;opponent_name:string;status:string;home_score:number|null;away_score:number|null;scheduled_at:string|null;league_name:string|null;country:string|null;team_id:string};
const emptyCounts={teams:0,womens:0,coaches:0,leagues:0,players:0};

export default function Home(){
 const router=useRouter();
 const [counts,setCounts]=useState(emptyCounts);
 const [teams,setTeams]=useState<Team[]>([]);
 const [reviewCounts,setReviewCounts]=useState<Record<string,number>>({});
 const [games,setGames]=useState<Game[]>([]);
 useEffect(()=>{getCachedSession().then(({data})=>{if(data.session)router.replace("/dashboard");});},[router]);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   const [mens,womens,coaches,leagues,players,teamRows,gameRows]=await Promise.all([
    supabase.from("teams").select("id",{count:"exact",head:true}).eq("active",true).eq("basketball_type","mens"),
    supabase.from("womens_teams").select("id",{count:"exact",head:true}).eq("active",true),
    supabase.from("coaches").select("id",{count:"exact",head:true}).eq("active",true),
    supabase.from("leagues").select("id",{count:"exact",head:true}).eq("active",true),
    supabase.from("profiles").select("id",{count:"exact",head:true}).eq("account_type","player").eq("profile_visibility","public").neq("moderation_status","suspended"),
    supabase.from("teams").select("id,name,country,league_name,logo_url,logo_bg").eq("active",true).eq("basketball_type","mens").order("name").limit(6),
    supabase.from("fan_live_games").select("id,team_id,opponent_name,status,home_score,away_score,scheduled_at,league_name,country").in("status",["live","scheduled"]).order("scheduled_at",{ascending:true,nullsFirst:false}).limit(8)
   ]);
   if(!active)return;
   setCounts({teams:mens.count||0,womens:womens.count||0,coaches:coaches.count||0,leagues:leagues.count||0,players:players.count||0});
   const listed=(teamRows.data||[]) as Team[];setTeams(listed);
   setGames((gameRows.data||[]) as Game[]);
   if(listed.length){
    const reviews=await supabase.from("reviews").select("team_id").in("team_id",listed.map(x=>x.id)).eq("status","approved");
    if(active){const next:Record<string,number>={};for(const row of reviews.data||[])next[row.team_id]=(next[row.team_id]||0)+1;setReviewCounts(next);}
   }
  })().catch(()=>{});
  return()=>{active=false;};
 },[]);
 return <main className="hc-template-home hc-home-redesign hc-ia-home hc-ia-public-home"><div className="page-container">
   <header className="hc-ia-welcome"><p className="eyebrow">THE GLOBAL BASKETBALL INTELLIGENCE HUB</p><h1>KNOW WHO YOU’RE SIGNING WITH<span>.</span></h1><p className="muted">Real player experiences. Check the team, coach, or league before you commit.</p><div className="hc-home-hero-actions"><Link href="/signup" className="hc-template-cta hc-home-cta">CREATE YOUR ACCOUNT <HoopIcon name="arrow-right" size={17}/></Link><Link href="/login" className="hc-home-signin">SIGN IN <HoopIcon name="arrow-up-right" size={15}/></Link></div><div className="hc-desk-hero-stats" aria-label="Live directory totals">{[{label:"MEN’S TEAMS",value:counts.teams},{label:"WOMEN’S TEAMS",value:counts.womens},{label:"COACHES",value:counts.coaches},{label:"LEAGUES",value:counts.leagues},{label:"PLAYERS",value:counts.players}].map(item=><div key={item.label}><strong>{item.value.toLocaleString()}</strong><span>{item.label}</span></div>)}</div></header>
   <section className="hc-desk-search-section" aria-label="Search HoopCheck"><SearchBar className="hc-ia-search" name="q" placeholder="Search teams, coaches, leagues, or players" ariaLabel="Search basketball directory"/><nav className="hc-desk-search-chips" aria-label="Search by category">{categories.map(item=><Link key={item.type} href={"/search?type="+item.type}>{item.label}</Link>)}</nav></section>
   <Link href="/live-games" className="hc-ia-live-strip"><span className="hc-ia-live-dot"/><span><strong>LIVE GAMES</strong><small>See live and upcoming games</small></span><span>Open hub <HoopIcon name="arrow-right" size={16}/></span></Link>
   {games.length>0&&<section className="hc-desk-section"><div className="hc-ia-section-heading"><div><p className="eyebrow">COURTSIDE</p><h2>LIVE & UPCOMING</h2></div><Link href="/live-games">All games <HoopIcon name="arrow-right" size={15}/></Link></div><div className="hc-desk-game-rail">{games.map(game=><Link href="/live-games" key={game.id} className="hc-desk-game-card"><span className={game.status==="live"?"hc-desk-game-status is-live":"hc-desk-game-status"}>{game.status==="live"?"● LIVE":"UPCOMING"}</span><strong>{game.opponent_name}</strong><span>{game.league_name||game.country||"Basketball"}</span><b>{game.home_score!==null&&game.away_score!==null?game.home_score+" – "+game.away_score:game.scheduled_at?new Date(game.scheduled_at).toLocaleString():"Schedule pending"}</b></Link>)}</div></section>}
   <section className="hc-ia-section hc-desk-section"><div className="hc-ia-section-heading"><div><p className="eyebrow">YOUR NEXT MOVE</p><h2>EXPLORE HOOPCHECK</h2></div><Link href="/directory">All directories <HoopIcon name="arrow-right" size={15}/></Link></div><div className="hc-template-category-grid hc-home-category-grid hc-ia-door-grid">{categories.map(category=><CategoryTile key={category.label} label={category.label} category={category.category} href={category.href} description={category.subtitle} count={category.category==="teams"?counts.teams:category.category==="womens"?counts.womens:category.category==="coaches"?counts.coaches:category.category==="leagues"?counts.leagues:counts.players} className="hc-home-category-tile"/>)}</div></section>
   <section className="hc-desk-section hc-desk-directory"><div className="hc-ia-section-heading"><div><p className="eyebrow">SCOUT THE LANDSCAPE</p><h2>TEAM DIRECTORY PREVIEW</h2></div><Link href="/teams">View all teams <HoopIcon name="arrow-right" size={15}/></Link></div><div className="hc-desk-team-table"><div className="hc-desk-team-row hc-desk-team-head"><span>TEAM</span><span>LEAGUE</span><span>COUNTRY</span><span>TRUST SCORE</span><span>REVIEWS</span><span/></div>{teams.map(team=><Link href={"/teams/"+team.id} className="hc-desk-team-row" key={team.id}><span className="hc-desk-team-name"><TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={38}/><strong>{team.name}</strong></span><span>{team.league_name||"—"}</span><span>{team.country||"—"}</span><span>—</span><span>{reviewCounts[team.id]||0}</span><span className="hc-desk-row-action">View <HoopIcon name="arrow-right" size={15}/></span></Link>)}{teams.length===0&&<p className="hc-desk-empty">Directory listings are loading or temporarily unavailable.</p>}</div></section>
   <section className="hc-desk-section hc-desk-how"><div className="hc-ia-section-heading"><div><p className="eyebrow">THE HOOPCHECK EDGE</p><h2>WHY CHECK BEFORE YOU SIGN?</h2></div></div><div className="hc-desk-three-grid"><article><span>01</span><h3>Search the record</h3><p>Find teams, coaches, leagues and players across the basketball world.</p></article><article><span>02</span><h3>Read real reviews</h3><p>Learn from player experiences before making your next move.</p></article><article><span>03</span><h3>Sign with confidence</h3><p>Make informed decisions about the people and organizations you work with.</p></article></div></section>
   <section className="hc-desk-section hc-desk-membership"><div className="hc-ia-section-heading"><div><p className="eyebrow">MEMBERSHIP</p><h2>CHOOSE YOUR ACCESS</h2></div><Link href="/membership">Membership details <HoopIcon name="arrow-right" size={15}/></Link></div><div className="hc-desk-plans"><article><p>START HERE</p><h3>Free</h3><strong>$0</strong><span>Explore HoopCheck and create your account.</span><Link href="/signup">Create account</Link></article><article><p>MORE INSIGHT</p><h3>Pro</h3><strong>$4.99 <small>/ month</small></strong><span>Expanded access to basketball research.</span><Link href="/membership">Explore Pro</Link></article><article><p>FULL ACCESS</p><h3>Premium</h3><strong>$9.99 <small>/ month</small></strong><span>Everything in Pro plus expanded research capabilities.</span><Link href="/membership">Explore Premium</Link></article></div></section>
 </div></main>;
}
