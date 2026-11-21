"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "../agents/network.css";

type PublicProfile = {id:string;display_name:string|null;username:string|null;
  avatar_url:string|null;avatar_moderation_status:string|null;country:string|null;};
type Creator = {profile_id:string;category:string;headline:string;description:string;website_url:string|null;profiles:PublicProfile};
const categoryNames:Record<string,string>={media:"Media",podcast:"Podcaster",trainer:"Trainer",photographer:"Photographer",analyst:"Analyst",other:"Creator"};
function profileName(p:PublicProfile){return p.display_name||p.username||"Basketball creator";}

export default function CreatorsPage(){
  const [creators,setCreators]=useState<Creator[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    void (async()=>{
      const response=await fetch("/api/network/creators",{cache:"no-store"});
      const payload=await response.json();
      if(!active)return;
      if(!response.ok)setError(payload.error||"Creator network is unavailable.");
      else setCreators((payload.creators||[]) as Creator[]);
      setLoading(false);
    })().catch(()=>{if(active){setError("The creator network is unavailable.");setLoading(false);}});
    return ()=>{active=false;};
  },[retry]);
  const filtered=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase();
    return creators.filter(c=>(category==="all"||category===c.category)
      && (!term||[c.profiles.display_name,c.profiles.username,c.profiles.country,c.headline,c.description,categoryNames[c.category]]
        .some(v=>v?.toLocaleLowerCase().includes(term))));
  },[creators,category,query]);
  return <main className="hc-network-page">
    <header className="hc-network-hero"><div>
      <p className="hc-network-eyebrow">HOOPCHECK™ / CREATOR COMMUNITY</p>
      <h1>Built by <span>creators.</span></h1>
      <p>Discover basketball media, storytellers, trainers, photographers, podcasters and analysts. Every creator chooses whether to publish a showcase.</p>
      <div className="hc-network-hero-actions"><Link href="/creator-studio" className="hc-network-action">Build my creator profile</Link><Link href="/feed" className="hc-network-ghost">Explore HoopFeed</Link></div>
    </div><div className="hc-network-score" aria-hidden="true"><span>CREATOR</span><strong>02</strong><small>THE NETWORK</small></div></header>
    <section className="hc-network-tools" aria-label="Browse creator profiles">
      <label htmlFor="hc-creator-search">Search creators</label>
      <input id="hc-creator-search" type="search" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search creators, topics or countries"/>
      <div className="hc-network-filters" aria-label="Creator categories">
        {(["all","media","podcast","trainer","photographer","analyst","other"] as const).map(kind=><button key={kind} type="button" aria-pressed={category===kind} onClick={()=>setCategory(kind)}>{kind==="all"?"All creators":categoryNames[kind]}</button>)}
      </div>
    </section>
    {loading?<p className="hc-network-state" role="status">Loading creator profiles…</p>
      :error?<section className="hc-network-state" role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(v=>v+1)}>Try again</button></section>
      :filtered.length?<section className="hc-network-grid" aria-label="Public creator profiles">
      {filtered.map(c=><article className="hc-network-card" key={c.profile_id}>
        <div className="hc-network-card-top">
          {c.profiles.avatar_url && c.profiles.avatar_moderation_status!=="pending" && c.profiles.avatar_moderation_status!=="rejected"
            ? <img src={c.profiles.avatar_url} alt="" className="hc-network-avatar"/>
            : <span className="hc-network-avatar hc-network-fallback">{profileName(c.profiles).slice(0,2).toUpperCase()}</span>}
          <span className="hc-network-category">{categoryNames[c.category]||"Creator"}</span>
        </div>
        <h2>{profileName(c.profiles)}</h2>
        <p className="hc-network-handle">{c.profiles.username?"@"+c.profiles.username:c.profiles.country||"Basketball creator"}</p>
        <p className="hc-network-description">{c.headline||c.description||"Explore this creator's public showcase."}</p>
        <div className="hc-network-card-bottom"><span>{c.profiles.country||"Global"}</span><Link href={"/creators/"+encodeURIComponent(c.profile_id)}>View showcase</Link></div>
      </article>)}
      </section>
      :<section className="hc-network-state"><h2>No creators found</h2><p>Only opted-in public profiles appear here. Be among the first basketball creators to publish a showcase.</p><Link href="/creator-studio">Set up creator profile</Link></section>}
    <p className="hc-network-disclaimer">Creator categories and biographies are self-described; they do not imply HoopCheck endorsement, identity verification or coaching credentials. Existing HoopFeed access and posting rules remain unchanged.</p>
  </main>;
}
