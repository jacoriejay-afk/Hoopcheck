"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import TeamLogo from "./TeamLogo";
import TrustScoreDial from "./TrustScoreDial";
import HomeDirectoryStats from "./HomeDirectoryStats";

type Team = { id:string; name:string; country:string|null; city:string|null; league_name:string|null; logo_url:string|null; logo_bg:"transparent"|"light"|"dark"|null };
type Game = { id:string; team_id:string; opponent_team_id:string|null; opponent_name:string; status:string; scheduled_at:string|null };
type TeamCount = { country:string; count:number };

const COUNTRY_POINTS: Record<string,[number,number]> = {
  "United States":[38,-97], "Canada":[56,-106], "Mexico":[23,-102], "Brazil":[-10,-52], "Argentina":[-38,-64], "Chile":[-30,-71], "United Kingdom":[55,-3], "France":[46,2], "Germany":[51,10], "Spain":[40,-4], "Italy":[42,12], "Greece":[39,22], "Serbia":[44,21], "Türkiye":[39,35], "Turkey":[39,35], "Azerbaijan":[40,47], "Georgia":[42,44], "Armenia":[40,45], "Lithuania":[56,24], "Latvia":[57,25], "Estonia":[59,25], "Poland":[52,20], "Czechia":[49,15], "Austria":[47,14], "Hungary":[47,20], "Romania":[46,25], "Bulgaria":[43,25], "Croatia":[45,16], "Bosnia and Herzegovina":[44,18], "Montenegro":[42,19], "Albania":[41,20], "North Macedonia":[41,22], "Ukraine":[49,32], "Russia":[60,90], "Netherlands":[52,5], "Belgium":[51,4], "Sweden":[61,15], "Finland":[64,26], "Norway":[62,10], "Switzerland":[47,8], "Portugal":[39,-8], "Ireland":[53,-8], "Israel":[31,35], "Lebanon":[34,36], "Japan":[36,138], "China":[35,104], "South Korea":[36,128], "Philippines":[13,122], "Australia":[-25,134], "New Zealand":[-41,174], "South Africa":[-29,24], "Egypt":[26,30], "Nigeria":[9,8], "Senegal":[14,-14], "Morocco":[32,-6], "Tunisia":[34,9]
};
const DOTS: [number,number][] = [];
for (let y=8;y<=91;y+=7) for(let x=3;x<=97;x+=4.5) {
  const nx=(x-50)/50, ny=(y-50)/50;
  const land = (nx*nx/0.82 + (ny+0.04)*(ny+0.04)/0.40 < 1 && x<48 && y<67) ||
    ((x>39&&x<72&&y>12&&y<57) && ((x-56)*(x-56)/390+(y-34)*(y-34)/520<1)) ||
    (x>68&&y>45&&y<88&&((x-82)*(x-82)/150+(y-67)*(y-67)/390<1)) ||
    (x>3&&x<20&&y>28&&y<78) || (x>77&&y<33&&y>10);
  if(land) DOTS.push([x,y]);
}

export default function HomeDesktopIdentity() {
  const [countryCounts,setCountryCounts]=useState<TeamCount[]>([]);
  const [featured,setFeatured]=useState<Team|null>(null);
  const [trust,setTrust]=useState<{score:number|null;reviewCount:number|null;verifiedReviewCount:number|null;explanation:string|null;locked?:boolean}|null>(null);
  const [ticker,setTicker]=useState<Array<{id:string;home:string;away:string;status:string;time:string}>>([]);

  useEffect(()=>{
    let active=true;
    void (async()=>{
      const [countryResult,womensCountryResult,teamResult,gameResult]=await Promise.all([
        supabase.from("teams").select("country").eq("active",true).eq("basketball_type","mens").not("country","is",null).limit(5000),
        supabase.from("womens_teams").select("country").eq("active",true).not("country","is",null).limit(5000),
        supabase.from("teams").select("id,name,country,city,league_name,logo_url,logo_bg").eq("active",true).eq("basketball_type","mens").order("name").limit(1).maybeSingle(),
        supabase.from("fan_live_games").select("id,team_id,opponent_team_id,opponent_name,status,scheduled_at").in("status",["live","scheduled"]).order("scheduled_at",{ascending:true,nullsFirst:false}).limit(12)
      ]);
      if(!active)return;
      const counts=new Map<string,number>();
      for(const row of [...(countryResult.data||[]),...(womensCountryResult.data||[])]){const country=(row.country||"").trim();if(country)counts.set(country,(counts.get(country)||0)+1);}
      setCountryCounts([...counts.entries()].map(([country,count])=>({country,count})));
      if(teamResult.data){setFeatured(teamResult.data as Team);}
      const games=(gameResult.data||[]) as Game[];
      const ids=[...new Set(games.flatMap(g=>[g.team_id,g.opponent_team_id].filter((v):v is string=>Boolean(v))))];
      const {data: names}=ids.length?await supabase.from("teams").select("id,name").in("id",ids):{data:[] as {id:string;name:string}[]};
      const nameMap=new Map((names||[]).map(t=>[t.id,t.name]));
      setTicker(games.map(g=>({id:g.id,home:nameMap.get(g.team_id)||"",away:(g.opponent_team_id?nameMap.get(g.opponent_team_id):null)||g.opponent_name||"",status:g.status,time:g.scheduled_at?new Date(g.scheduled_at).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}):"—"})).filter(g=>g.home&&g.away));
    })().catch(()=>{if(active){setCountryCounts([]);setTicker([]);}});
    return()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(!featured?.id)return;
    let active=true;
    fetch("/api/trust-score?entityType=team&entityId="+encodeURIComponent(featured.id),{cache:"no-store"})
      .then(r=>r.ok?r.json():null).then(data=>{if(active&&data)setTrust(data);})
      .catch(()=>{if(active)setTrust(null);});
    return()=>{active=false;};
  },[featured?.id]);

  const pins=useMemo(()=>countryCounts.flatMap(item=>{
    const point=COUNTRY_POINTS[item.country];
    return point?[{country:item.country,count:item.count,x:((point[1]+180)/360)*100,y:((90-point[0])/180)*100}]:[];
  }),[countryCounts]);

  return <>
    {ticker.length>0&&<div className="hc-d3-ticker" aria-label="Live and upcoming fixtures"><div className="hc-d3-ticker__track">{[...ticker,...ticker].map((game,index)=><span className="hc-d3-ticker__item" key={game.id+"-"+index}>{game.status==="live"&&<i aria-label="Live"/>}<strong>{game.status==="live"?"LIVE": "UP NEXT"}</strong><span>{game.home} <b>vs</b> {game.away}</span><time>{game.time}</time></span>)}</div></div>}
    <section className="hc-d3-hero">
      <div className="hc-d3-hero__inner">
        <div className="hc-d3-hero__copy">
          <p className="hc-d3-eyebrow">THE GLOBAL BASKETBALL INTELLIGENCE HUB</p>
          <h1>KNOW WHO YOU’RE <em>SIGNING WITH.</em></h1>
          <p className="hc-d3-hero__sub">Explore teams, coaches, leagues, and real basketball experiences. Built for players and fans worldwide.</p>
          <HomeDirectoryStats/>
          <div className="hc-home-hero-actions"><Link href="/signup" className="hc-template-cta hc-home-cta">CREATE YOUR ACCOUNT</Link><Link href="/login" className="hc-home-signin">SIGN IN</Link></div>
        </div>
        <div className="hc-d3-hero__visual">
          <div className="hc-d3-map" aria-label="World map showing countries with active teams">
            <svg viewBox="0 0 100 100" role="img" aria-hidden="true">{DOTS.map(([x,y],i)=><circle key={i} cx={x} cy={y} r=".52" fill="currentColor" opacity=".28"/>)}
              {pins.map(pin=><g key={pin.country}><circle cx={pin.x} cy={pin.y} r="1.35" fill="#FF5A1F"/><circle cx={pin.x} cy={pin.y} r="3" fill="none" stroke="#FF5A1F" strokeWidth=".45" opacity=".55"/><title>{pin.country}: {pin.count} teams</title></g>)}</svg>
            <span className="hc-d3-map__label">DIRECTORY FOOTPRINT</span>
          </div>
          {featured&&<article className="hc-d3-feature-card">
            <div className="hc-d3-feature-card__top"><span>DIRECTORY SPOTLIGHT</span><span>REAL TEAM DATA</span></div>
            <div className="hc-d3-feature-card__body"><TeamLogo name={featured.name} logoUrl={featured.logo_url} logoBg={featured.logo_bg} size={62}/><div><h2>{featured.name}</h2><p>{[featured.league_name,featured.country].filter(Boolean).join(" · ")||featured.city||"Team directory"}</p></div></div>
            <div className="hc-d3-feature-card__metrics"><TrustScoreDial score={trust?.score??null} explanation={trust?.explanation||"Not enough player reviews to calculate a Trust Score yet."} reviewCount={trust?.reviewCount??0} verifiedReviewCount={trust?.verifiedReviewCount??0} size="mini"/><div><strong>{trust?.reviewCount==null?"—":trust.reviewCount}</strong><small>REVIEWS</small></div></div>
          </article>}
        </div>
      </div>
      <svg className="hc-d3-court" viewBox="0 0 900 520" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="2"><path d="M450 0V520M260 0A190 190 0 0 0 260 520M640 0A190 190 0 0 1 640 520"/><circle cx="450" cy="260" r="74"/><path d="M0 0H900V520H0Z"/></g></svg>
    </section>
  </>;
}
