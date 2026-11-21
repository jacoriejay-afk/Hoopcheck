"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import "../agents/network.css";

type Category="media"|"podcast"|"trainer"|"photographer"|"analyst"|"other";
const categoryOptions:[Category,string][]=[["media","Media / journalist"],["podcast","Podcaster"],["trainer","Trainer"],["photographer","Photographer"],["analyst","Basketball analyst"],["other","Other basketball creator"]];
const validHttps=(raw:string)=>{try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname.includes(".")&&raw.length<=250;}catch{return false;}};

export default function CreatorStudioPage(){
  const [userId,setUserId]=useState("");
  const [accountPublic,setAccountPublic]=useState(false);
  const [profileReady,setProfileReady]=useState(false);
  const [category,setCategory]=useState<Category>("media");
  const [headline,setHeadline]=useState("");
  const [description,setDescription]=useState("");
  const [website,setWebsite]=useState("");
  const [published,setPublished]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void(async()=>{
      const {data:{session}}=await supabase.auth.getSession();
      if(!active)return;
      if(!session?.user){window.location.replace("/login?returnTo=/creator-studio");return;}
      setUserId(session.user.id);
      const response=await fetch("/api/network/creator-studio",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      const payload=await response.json();
      if(!active)return;
      if(!response.ok||!payload.profile){setError(payload.error||"Creator Studio is unavailable.");setLoading(false);return;}
      setAccountPublic(payload.profile.profile_visibility==="public"&&payload.profile.moderation_status==="normal");
      setProfileReady(true);
      if(payload.creator){
        const value=payload.creator.category;
        if(categoryOptions.some(([key])=>key===value))setCategory(value as Category);
        setHeadline(payload.creator.headline||"");setDescription(payload.creator.description||"");
        setWebsite(payload.creator.website_url||"");setPublished(Boolean(payload.creator.is_published));
      }
      setLoading(false);
    })().catch(()=>{if(active){setError("Could not open Creator Studio.");setLoading(false);}});
    return()=>{active=false;};
  },[]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!userId||saving)return;
    setNotice("");setError("");
    const url=website.trim();
    if(url&&!validHttps(url)){setError("Website must be a valid https:// address without embedded login details.");return;}
    if(headline.trim().length>140||description.trim().length>600){setError("Keep your headline under 140 characters and description under 600.");return;}
    setSaving(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setError("Please sign in again.");return;}
      const response=await fetch("/api/network/creator-studio",{
        method:"PUT",
        headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
        body:JSON.stringify({category,headline:headline.trim(),description:description.trim(),website_url:url||null,is_published:published})
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"Unable to save creator showcase.");
      setNotice(published?(payload.publicly_visible?"Creator showcase published.":"Saved. Make your main profile public to appear in discovery."):"Creator draft saved privately.");
    }catch{setError("Could not save your creator profile. Check your connection and try again.");}
    finally{setSaving(false);}
  }
  return <main className="hc-network-page">
    <nav className="hc-network-back"><Link href="/creators">Creator network</Link> / <span>Studio</span></nav>
    <header className="hc-network-hero"><div>
      <p className="hc-network-eyebrow">YOUR HOOPCHECK™ CREATOR STUDIO</p><h1>Make your <span>mark.</span></h1>
      <p>Launch a basketball creator showcase without changing your account type or subscription. Everything starts as a private draft until you publish.</p>
      <div className="hc-network-hero-actions"><Link className="hc-network-ghost" href="/account#visibility">Main profile privacy</Link>{userId&&<Link className="hc-network-ghost" href={"/creators/"+encodeURIComponent(userId)}>View public showcase</Link>}</div>
    </div><div className="hc-network-score" aria-hidden="true"><span>CREATE</span><strong>HC</strong><small>YOUR STUDIO</small></div></header>
    {loading?<p className="hc-network-state" role="status">Loading studio…</p>
      :error&&!profileReady?<section className="hc-network-state" role="alert">{error}</section>
      :<form onSubmit={e=>void save(e)} className="hc-creator-editor">
        <section className="hc-network-panel">
          <h2>Creator identity</h2>
          <label htmlFor="hc-creator-category">Category</label>
          <select id="hc-creator-category" value={category} onChange={e=>setCategory(e.target.value as Category)}>
            {categoryOptions.map(([value,text])=><option value={value} key={value}>{text}</option>)}
          </select>
          <label htmlFor="hc-creator-headline">Headline · {headline.length}/140</label>
          <input id="hc-creator-headline" value={headline} maxLength={140} onChange={e=>setHeadline(e.target.value)} placeholder="Basketball stories, film and player development"/>
          <label htmlFor="hc-creator-description">About your work · {description.length}/600</label>
          <textarea id="hc-creator-description" maxLength={600} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Share the type of basketball content you create and who it is for." rows={5}/>
          <label htmlFor="hc-creator-website">Website (optional, HTTPS only)</label>
          <input id="hc-creator-website" type="url" maxLength={250} value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com" inputMode="url"/>
        </section>
        <section className="hc-network-panel">
          <h2>Publication</h2>
          <div className="hc-creator-publish">
            <input id="hc-creator-published" type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/>
            <label htmlFor="hc-creator-published">Publish my creator showcase in the public creator directory. I understand the category, bio and approved profile image will be shown.</label>
          </div>
          {!accountPublic&&<p>Your main HoopCheck profile is not publicly discoverable. Even if this showcase is published, it will stay out of discovery until you make your main profile public and any moderation holds are cleared.</p>}
          <p>Publishing does not grant verified status, special posting permissions, or access to paid content. All existing membership and community rules still apply.</p>
          <div className="hc-creator-actions"><button type="submit" disabled={saving}>{saving?"Saving…":"Save creator profile"}</button><Link className="hc-network-ghost" href="/creators">Creator network</Link></div>
          {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
        </section>
      </form>}
  </main>;
}
