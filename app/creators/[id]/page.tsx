"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect,useState } from "react";
import "../../agents/network.css";

type Profile={id:string;display_name:string|null;username:string|null;avatar_url:string|null;avatar_moderation_status:string|null;country:string|null;};
type Creator={profile_id:string;category:string;headline:string;description:string;website_url:string|null;profiles:Profile};
const labels:Record<string,string>={media:"Media",podcast:"Podcaster",trainer:"Trainer",photographer:"Photographer",analyst:"Analyst",other:"Creator"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safePublicWebsite(raw:string|null){
  if(!raw)return null;
  try{const url=new URL(raw);return url.protocol==="https:"&&!url.username&&!url.password&&url.hostname.includes(".")?url.href:null;}
  catch{return null;}
}
export default function CreatorProfilePage(){
  const {id}=useParams<{id:string}>();
  const [creator,setCreator]=useState<Creator|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    if(!uuid.test(id||"")){setError("Creator profile not found.");setLoading(false);return;}
    void(async()=>{
      const response=await fetch("/api/network/creators?id="+encodeURIComponent(id),{cache:"no-store"});
      const payload=await response.json();
      if(!active)return;
      if(!response.ok)setError(payload.error||"This creator showcase is unavailable.");
      else if(!payload.creator)setError("This creator showcase is private or unpublished.");
      else setCreator(payload.creator as Creator);
      setLoading(false);
    })().catch(()=>{if(active){setError("Creator profile could not be loaded.");setLoading(false);}});
    return()=>{active=false;};
  },[id]);
  if(loading)return<main className="hc-network-page"><p className="hc-network-state" role="status">Loading creator showcase…</p></main>;
  if(!creator)return<main className="hc-network-page"><section className="hc-network-state" role="alert"><h1>Showcase unavailable</h1><p>{error}</p><Link href="/creators">Browse creators</Link></section></main>;
  const name=creator.profiles.display_name||creator.profiles.username||"Basketball creator";
  const website=safePublicWebsite(creator.website_url);
  return <main className="hc-network-page hc-network-detail">
    <nav className="hc-network-back"><Link href="/creators">Creator network</Link> / <span>Showcase</span></nav>
    <header className="hc-network-hero"><div className="hc-network-detail-person">
      {creator.profiles.avatar_url && creator.profiles.avatar_moderation_status!=="pending" && creator.profiles.avatar_moderation_status!=="rejected"
        ? <img className="hc-network-avatar hc-network-profile-avatar" alt="" src={creator.profiles.avatar_url}/>
        : <span className="hc-network-avatar hc-network-profile-avatar hc-network-fallback">{name.slice(0,2).toUpperCase()}</span>}
      <div><p className="hc-network-eyebrow">CREATOR SHOWCASE / {labels[creator.category]?.toUpperCase()||"CREATOR"}</p>
        <h1>{name}</h1><p>{creator.headline||"Basketball community creator"}</p>
        <span className="hc-network-handle">{creator.profiles.username?"@"+creator.profiles.username+" · ":""}{creator.profiles.country||"Global"}</span>
      </div>
    </div></header>
    <section className="hc-network-detail-grid">
      <article className="hc-network-panel"><h2>About this creator</h2><p>{creator.description||"This creator has not added a longer introduction."}</p></article>
      <article className="hc-network-panel"><h2>Creative focus</h2><p>{labels[creator.category]||"Creator"} · self-described</p></article>
    </section>
    <div className="hc-network-detail-actions">{website&&<a className="hc-network-action" href={website} target="_blank" rel="noopener noreferrer">Visit creator website</a>}
      <Link href="/creators" className="hc-network-ghost">Browse other creators</Link></div>
    <p className="hc-network-disclaimer">This showcase was published by its owner. Category, description and linked sites are self-reported. HoopCheck has not independently verified their credentials or endorsed external content.</p>
  </main>;
}
