"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import "./network.css";

type Agent = {
  id: string; display_name: string | null; username: string | null;
  avatar_url: string | null; avatar_moderation_status: string | null;
  country: string | null; bio: string | null; experience_summary: string | null;
  account_type: "agent" | "scout"; identity_verification_status: string | null;
};
type Scope = "all" | "agent" | "scout" | "verified";

const badgeText = (a: Agent) => a.identity_verification_status === "verified"
  ? "Identity checked" : "Credentials not verified";
const label = (a: Agent) => a.display_name?.trim() || a.username || "Basketball professional";
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "HC"; }

export default function AgentsPage() {
  const [people,setPeople] = useState<Agent[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [q,setQ] = useState("");
  const [scope,setScope] = useState<Scope>("all");
  const [retry,setRetry] = useState(0);
  useEffect(()=>{
    let active = true;
    void (async()=>{
      setLoading(true);setError("");
      const {data,error:loadError} = await supabase.from("profiles")
        .select("id,display_name,username,avatar_url,avatar_moderation_status,country,bio,experience_summary,account_type,identity_verification_status")
        .in("account_type",["agent","scout"])
        .eq("profile_visibility","public").eq("moderation_status","normal")
        .order("display_name",{ascending:true}).limit(200);
      if (!active) return;
      if (loadError) setError("Professional profiles are unavailable. Try again.");
      else setPeople((data || []) as Agent[]);
      setLoading(false);
    })().catch(()=>{if(active){setLoading(false);setError("Unable to load the directory.");}});
    return ()=>{active=false;};
  },[retry]);
  const filtered = useMemo(()=>{
    const term=q.trim().toLocaleLowerCase();
    return people.filter(p=>(scope==="all" || scope==="verified" && p.identity_verification_status==="verified" || p.account_type===scope)
      && (!term || [p.display_name,p.username,p.country,p.bio,p.experience_summary].some(v=>v?.toLocaleLowerCase().includes(term))));
  },[people,q,scope]);
  return <main className="hc-network-page">
    <header className="hc-network-hero">
      <div><p className="hc-network-eyebrow">HOOPCHECK™ / PROFESSIONAL NETWORK</p><h1>Agents <span>&amp;</span> Scouts</h1>
        <p>Discover basketball agents and scouts with public profiles. Filter for identity-checked members and research their experience before connecting.</p>
        <div className="hc-network-hero-actions"><Link href="/connections" className="hc-network-action">My connections</Link><Link href="/scam-alerts" className="hc-network-ghost">Stay safe from impersonation</Link></div>
      </div>
      <div className="hc-network-score" aria-hidden="true"><span>AGENCY</span><strong>01</strong><small>THE NETWORK</small></div>
    </header>
    <section className="hc-network-tools" aria-label="Find a basketball professional">
      <label htmlFor="hc-agent-search">Find professionals</label>
      <input id="hc-agent-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name, agency experience or country" type="search" autoComplete="off"/>
      <div className="hc-network-filters" aria-label="Professional type">
        {([["all","Everyone"],["agent","Agents"],["scout","Scouts"],["verified","Identity checked"]] as const).map(([value,text])=>
          <button key={value} type="button" aria-pressed={scope===value} onClick={()=>setScope(value)}>{text}</button>)}
      </div>
    </section>
    {loading ? <p className="hc-network-state" role="status">Loading professional profiles…</p>
      : error ? <div className="hc-network-state" role="alert">{error} <button type="button" onClick={()=>setRetry(v=>v+1)}>Retry</button></div>
      : filtered.length ? <section className="hc-network-grid" aria-label="Agents and scouts">
        {filtered.map(p=><article className="hc-network-card" key={p.id}>
          <div className="hc-network-card-top">
            {p.avatar_url && p.avatar_moderation_status !== "pending" && p.avatar_moderation_status !== "rejected"
              ? <img src={p.avatar_url} alt="" className="hc-network-avatar"/>
              : <span className="hc-network-avatar hc-network-fallback">{initials(label(p))}</span>}
            <span className="hc-network-role">{p.account_type.toUpperCase()}</span>
          </div>
          <h2>{label(p)}</h2><p className="hc-network-handle">{p.username ? "@"+p.username : p.country || "Basketball network"}</p>
          <p className="hc-network-verification">{badgeText(p)}</p>
          <p className="hc-network-description">{p.experience_summary || p.bio || "Explore this professional's public HoopCheck profile."}</p>
          <div className="hc-network-card-bottom"><span>{p.country || "Location not listed"}</span><Link href={"/agents/"+encodeURIComponent(p.id)}>View profile</Link></div>
        </article>)}
      </section>
      : <section className="hc-network-state"><h2>No matching professionals yet</h2><p>Only public, normally moderated profiles appear here. Identity-checked profiles show only after an independent ID check; no accounts or credentials are invented.</p><button type="button" onClick={()=>{setQ("");setScope("all");}}>Clear filters</button></section>}
    <p className="hc-network-disclaimer">An identity check confirms a person's identity, not agency authorization, professional licensing, successful placements, or the legitimacy of an offer. Verify credentials and club contacts independently.</p>
  </main>;
}
