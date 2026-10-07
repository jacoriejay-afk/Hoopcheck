"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import FollowButton from "../../components/FollowButton";

type Player = {
  id:string; display_name:string|null; username:string|null; first_name:string|null;
  last_name:string|null; country:string|null; current_country:string|null;
  current_team:string|null; position:string|null; years_pro:number|null;
  player_verified:boolean; avatar_url:string|null; basketball_type:string|null; free_agent:boolean;
};

export default function PlayersPage(){
  const [players,setPlayers]=useState<Player[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [country,setCountry]=useState("");
  const [type,setType]=useState("");
  const [page,setPage]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const size=24;

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      setLoading(true);
      let req=supabase.from("profiles")
        .select("id,display_name,username,first_name,last_name,country,current_country,current_team,position,years_pro,player_verified,avatar_url,basketball_type,free_agent",{count:"exact"})
        .eq("account_type","player")
        .eq("profile_visibility","public")
        .neq("moderation_status","suspended")
        .order("display_name",{ascending:true});
      if(query.trim()){
        const term=query.trim().replace(/[%_]/g,"\\$&");
        req=req.or(`display_name.ilike.%${term}%,username.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,current_team.ilike.%${term}%,current_country.ilike.%${term}%`);
      }
      if(country) req=req.eq("current_country",country);
      if(type) req=req.eq("basketball_type",type);
      const {data,count,error}=await req.range(page*size,page*size+size-1);
      if(mounted){
        setPlayers(error?[]:(data||[]) as Player[]);
        const total=count||0;
        setHasMore((page+1)*size<total);
        setLoading(false);
      }
    })();
    return()=>{mounted=false};
  },[query,country,type,page]);

  const countries=Array.from(new Set(players.map(p=>p.current_country||p.country).filter(Boolean) as string[])).sort();

  return <main className="page-shell">
    <div className="page-container">
      <header className="topbar">
        <Link href="/dashboard" className="brand">HOOPCHECK</Link>
        <nav className="topnav"><Link href="/search">Search</Link><Link href="/teams">Teams</Link><Link href="/profile">Profile</Link></nav>
      </header>
      <section className="hero-card">
        <p className="eyebrow">PLAYER DIRECTORY</p>
        <h1>Find Players</h1>
        <p className="muted">Research professional players, follow talent, and discover basketball experience across the global game.</p>
        <div className="actions">
          <Link href="/womens" className="btn dark">Women’s Basketball</Link>
          <Link href="/search" className="btn">Global Search</Link>
        </div>
      </section>
      <section className="dashboard-card" style={{marginTop:18}}>
        <div className="research-search">
          <div className="search-label">PLAYER SEARCH</div>
          <input value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} placeholder="Search players, teams, countries..." aria-label="Search players"/>
          <div className="team-filter-row">
            <select value={country} onChange={e=>{setCountry(e.target.value);setPage(0)}}><option value="">All countries</option>{countries.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <select value={type} onChange={e=>{setType(e.target.value);setPage(0)}}><option value="">All basketball</option><option value="mens">Men’s</option><option value="womens">Women’s</option></select>
          </div>
        </div>
      </section>
      {loading ? <div className="dashboard-card" style={{marginTop:18}}><HoopLoading label="Scanning player directory..." /></div> :
      <section className="grid" style={{marginTop:18}}>
        {players.map(p=>{
          const name=p.display_name || [p.first_name,p.last_name].filter(Boolean).join(" ") || p.username || "HoopCheck Player";
          return <article className="dashboard-card" key={p.id}>
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              {p.avatar_url ? <img src={p.avatar_url} alt="" style={{width:58,height:58,borderRadius:"50%",objectFit:"cover",border:"1px solid var(--border)"}}/> : <div className="player-avatar-fallback">HC</div>}
              <div><span className="card-kicker">{p.basketball_type==="womens"?"WOMEN’S":"MEN’S"} PLAYER</span><h2>{name} {p.player_verified&&<span title="Verified professional player" style={{color:"var(--orange)"}}>✓</span>}</h2></div>
            </div>
            <p className="muted">{p.position||"Position not listed"} · {p.years_pro==null?"Years pro not listed":p.years_pro+" years pro"}</p>
            <p>{p.free_agent?"🟠 Free Agent":p.current_team||"Team not listed"}{p.current_country?" · "+p.current_country:""}</p>
            <div className="actions"><FollowButton targetType="player" targetId={p.id}/><Link href={"/players/"+p.id} className="btn dark">View Profile</Link></div>
          </article>
        })}
        {!players.length&&<div className="dashboard-card"><h2>No players found.</h2><p className="muted">Try a different name, country, or basketball type.</p></div>}
      </section>}
      {!loading&&players.length>0&&<div style={{display:"flex",justifyContent:"center",gap:12,padding:"20px 0 40px",flexWrap:"wrap"}}>
        <button className="btn dark" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>← Previous</button>
        <span style={{display:"inline-flex",alignItems:"center",color:"var(--page-muted)",padding:"0 8px"}}>Page {page+1}</span>
        <button className="btn dark" disabled={!hasMore} onClick={()=>setPage(p=>p+1)}>Next →</button>
      </div>}
    </div>
  </main>;
}
