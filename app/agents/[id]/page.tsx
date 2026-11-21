"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import "../network.css";

type Agent = { id:string; account_type:string; display_name:string|null; username:string|null;
 avatar_url:string|null; avatar_moderation_status:string|null; country:string|null;
 bio:string|null; experience_summary:string|null; agency_name:string|null; website_url:string|null; identity_checked:boolean; };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AgentProfilePage(){
  const {id}=useParams<{id:string}>();
  const [person,setPerson]=useState<Agent|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    if(!uuid.test(id||"")){setError("This professional profile could not be found.");setLoading(false);return;}
    void (async()=>{
      const response=await fetch("/api/network/agents?id="+encodeURIComponent(id),{cache:"no-store"});
      const payload=await response.json();
      if(!active)return;
      if(!response.ok)setError(payload.error||"This professional profile is unavailable.");
      else if(!payload.person)setError("This professional profile is unavailable or private.");
      else setPerson(payload.person as Agent);
      setLoading(false);
    })().catch(()=>{if(active){setError("Could not load the professional profile.");setLoading(false);}});
    return ()=>{active=false;};
  },[id]);
  if(loading)return <main className="hc-network-page"><p className="hc-network-state" role="status">Loading profile…</p></main>;
  if(!person)return <main className="hc-network-page"><section className="hc-network-state" role="alert"><h1>Profile unavailable</h1><p>{error}</p><Link href="/agents">Back to Agents &amp; Scouts</Link></section></main>;
  const name=person.display_name||person.username||"HoopCheck professional";
  return <main className="hc-network-page hc-network-detail">
    <nav className="hc-network-back"><Link href="/agents">Agents &amp; Scouts</Link> / <span>Profile</span></nav>
    <header className="hc-network-hero">
      <div className="hc-network-detail-person">
        {person.avatar_url && person.avatar_moderation_status!=="pending" && person.avatar_moderation_status!=="rejected"
          ? <img className="hc-network-avatar hc-network-profile-avatar" src={person.avatar_url} alt=""/>
          : <span className="hc-network-avatar hc-network-profile-avatar hc-network-fallback">{name.slice(0,2).toUpperCase()}</span>}
        <div><p className="hc-network-eyebrow">{person.account_type==="scout"?"SCOUT PROFILE":"AGENT PROFILE"}</p>
          <h1>{name}</h1><p>{person.username?"@"+person.username+" · ":""}{person.country||"Country not listed"}</p>
          <span className="hc-network-verification">{person.identity_checked?"Identity checked":"Identity not verified"}</span>
        </div>
      </div>
    </header>
    <div className="hc-network-detail-grid">
      <section className="hc-network-panel"><h2>About</h2><p>{person.bio||"This member has not added a public biography."}</p></section>
      <section className="hc-network-panel"><h2>Professional focus</h2><p>{person.experience_summary||"Professional focus not listed."}</p><p>{person.agency_name?"Agency (self-reported): "+person.agency_name:"Agency not listed."}</p></section>
    </div>
    <div className="hc-network-detail-actions"><Link href="/connections" className="hc-network-action">Explore connections</Link><Link href="/scam-alerts" className="hc-network-ghost">Report a suspicious offer</Link></div>
    <p className="hc-network-disclaimer">HoopCheck does not certify a person's agency, licensing, representation authority or placement history. An identity-checked label means identity verification only. Never pay placement fees or share confidential records without independent verification.</p>
  </main>;
}
