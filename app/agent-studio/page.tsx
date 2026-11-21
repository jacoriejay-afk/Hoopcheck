"use client";

import { useEffect,useState,type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import "../agents/network.css";

export default function AgentStudioPage(){
  const [userId,setUserId]=useState("");
  const [role,setRole]=useState("");
  const [identityChecked,setIdentityChecked]=useState(false);
  const [reviewStatus,setReviewStatus]=useState("unreviewed");
  const [publicName,setPublicName]=useState("");
  const [agency,setAgency]=useState("");
  const [headline,setHeadline]=useState("");
  const [description,setDescription]=useState("");
  const [country,setCountry]=useState("");
  const [website,setWebsite]=useState("");
  const [published,setPublished]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let active=true;
    void(async()=>{
      const {data:{session}}=await supabase.auth.getSession();
      if(!active)return;
      if(!session?.user){window.location.replace("/login?returnTo=/agent-studio");return;}
      setUserId(session.user.id);
      const response=await fetch("/api/network/agent-studio",{
        headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"
      });
      const payload=await response.json();
      if(!active)return;
      if(!response.ok){setError(payload.error||"Professional Studio is unavailable.");setLoading(false);return;}
      setRole(payload.profile.account_type);
      setIdentityChecked(Boolean(payload.profile.identity_checked));
      if(payload.showcase){
        setPublicName(payload.showcase.public_name||"");setAgency(payload.showcase.agency_name||"");
        setHeadline(payload.showcase.headline||"");setDescription(payload.showcase.description||"");
        setCountry(payload.showcase.country||"");setWebsite(payload.showcase.website_url||"");
        setPublished(Boolean(payload.showcase.is_published));
        setReviewStatus(payload.showcase.review_status||"unreviewed");
      }
      setLoading(false);
    })().catch(()=>{if(active){setError("Could not open Professional Studio.");setLoading(false);}});
    return()=>{active=false;};
  },[]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!role||saving)return;setError("");setNotice("");
    if(published&&publicName.trim().length<2){setError("Enter the public name you want to show before publishing.");return;}
    if(website.trim()){
      try{const u=new URL(website.trim());if(u.protocol!=="https:"||u.username||u.password||!u.hostname.includes("."))throw Error();}
      catch{setError("Use a valid HTTPS website URL.");return;}
    }
    setSaving(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setError("Please sign in again.");return;}
      const response=await fetch("/api/network/agent-studio",{
        method:"PUT",
        headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
        body:JSON.stringify({
          public_name:publicName.trim(),agency_name:agency.trim(),headline:headline.trim(),
          description:description.trim(),country:country.trim(),
          website_url:website.trim()||null,is_published:published
        })
      });
      const data=await response.json();
      if(!response.ok){setError(data.error||"Unable to save professional showcase.");return;}
      setReviewStatus("unreviewed");
      setNotice(published?"Your professional showcase is published. If your name, agency or website changed, any previous professional review must be repeated.":"Your professional showcase was saved as a private draft.");
    }catch{setError("Could not save changes. Check your connection and try again.");}
    finally{setSaving(false);}
  }
  return <main className="hc-network-page">
    <nav className="hc-network-back"><Link href="/agents">Agents &amp; Scouts</Link> / <span>Professional Studio</span></nav>
    <header className="hc-network-hero"><div>
      <p className="hc-network-eyebrow">HOOPCHECK™ / PROFESSIONAL STUDIO</p>
      <h1>Your network. <span>Your terms.</span></h1>
      <p>Agent and scout account profiles stay private. You can separately publish the specific professional details you enter here—nothing else is pulled from your private account.</p>
      <div className="hc-network-hero-actions"><Link href="/agents" className="hc-network-ghost">Back to directory</Link>{userId&&<Link className="hc-network-ghost" href={"/agents/"+encodeURIComponent(userId)}>View public showcase</Link>}</div>
    </div></header>
    {loading?<p className="hc-network-state" role="status">Loading Professional Studio…</p>
      :!role?<section className="hc-network-state" role="alert"><h2>Professional Studio unavailable</h2><p>{error}</p><Link href="/account">Account settings</Link></section>
      :<form className="hc-creator-editor" onSubmit={e=>void save(e)}>
        <section className="hc-network-panel"><h2>Public professional details</h2>
          <p className="hc-network-handle">Account role: {role==="agent"?"Agent":"Scout"} · {identityChecked?"Identity checked":"Identity not checked"} · {reviewStatus==="approved"?"Professionally reviewed":reviewStatus==="rejected"?"Review not approved":"Not professionally reviewed"}</p>
          <label htmlFor="hc-agent-name">Public name · {publicName.length}/80</label>
          <input id="hc-agent-name" maxLength={80} value={publicName} onChange={e=>setPublicName(e.target.value)} placeholder="Name to display in the professional directory"/>
          <label htmlFor="hc-agent-agency">Agency or organization (self-reported) · {agency.length}/120</label>
          <input id="hc-agent-agency" maxLength={120} value={agency} onChange={e=>setAgency(e.target.value)} placeholder="Agency, academy, or independent"/>
          <label htmlFor="hc-agent-headline">Professional headline · {headline.length}/140</label>
          <input id="hc-agent-headline" maxLength={140} value={headline} onChange={e=>setHeadline(e.target.value)} placeholder="Basketball scouting and representation"/>
          <label htmlFor="hc-agent-description">Experience and focus · {description.length}/600</label>
          <textarea id="hc-agent-description" value={description} maxLength={600} onChange={e=>setDescription(e.target.value)} rows={5} placeholder="Describe your work and the players, regions or leagues you cover."/>
          <label htmlFor="hc-agent-country">Public country (optional) · {country.length}/80</label>
          <input id="hc-agent-country" maxLength={80} value={country} onChange={e=>setCountry(e.target.value)} placeholder="Country you choose to share"/>
          <label htmlFor="hc-agent-website">Professional website (optional, HTTPS only)</label>
          <input id="hc-agent-website" maxLength={250} type="url" inputMode="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com"/>
        </section>
        <section className="hc-network-panel"><h2>Publish on HoopCheck</h2>
          <div className="hc-creator-publish"><input id="hc-agent-publish" type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/>
            <label htmlFor="hc-agent-publish">I choose to show these specific fields publicly in the Agents &amp; Scouts directory, including an identity-check indicator if my account has one.</label>
          </div>
          <p>Agency details are self-declared until independently reviewed by authorized HoopCheck moderators. An identity check alone does not verify licensing, placement history, professional authority, or a team's endorsement. Your underlying account remains private.</p>
          {published && <p><Link href="/support?agentVerification=1">Request a confidential professional review</Link> after publishing your showcase. Provide only non-sensitive, independently verifiable official contact information.</p>}
          <div className="hc-creator-actions"><button type="submit" disabled={saving}>{saving?"Saving…":"Save professional showcase"}</button></div>
          {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
        </section>
      </form>}
  </main>;
}
