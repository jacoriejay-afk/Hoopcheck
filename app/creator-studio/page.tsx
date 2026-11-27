"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { withHoopChatDeadline } from "../../apps/mobile/src/native/hoopChatLoad";
import { creatorStudioOwner, createStudioEpoch } from "../../lib/creator-studio-scope";
import "../agents/network.css";

type Category="media"|"podcast"|"trainer"|"photographer"|"analyst"|"other";
const categoryOptions:[Category,string][]=[["media","Media / journalist"],["podcast","Podcaster"],["trainer","Trainer"],["photographer","Photographer"],["analyst","Basketball analyst"],["other","Other basketball creator"]];
const validHttps=(raw:string)=>{try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname.includes(".")&&raw.length<=250;}catch{return false;}};

export default function CreatorStudioPage(){
  const [userId,setUserId]=useState("");
  const [accountNormal,setAccountNormal]=useState(true);
  const [publicName,setPublicName]=useState("");
  const [country,setCountry]=useState("");
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
  const [reload,setReload]=useState(0);
  const scope=useRef(createStudioEpoch());
  const saveLock=useRef<number|null>(null);
  const loadRequest=useRef<AbortController|null>(null);
  const saveRequest=useRef<AbortController|null>(null);
  useEffect(()=>{
    const clear=()=>{
      scope.current.invalidate();
      loadRequest.current?.abort();saveRequest.current?.abort();saveLock.current=null;
      setUserId("");setProfileReady(false);setAccountNormal(false);setLoading(true);setSaving(false);
      setPublicName("");setCountry("");setCategory("media");setHeadline("");setDescription("");setWebsite("");setPublished(false);setError("");setNotice("");
    };
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"||(event==="SIGNED_IN"&&scope.current.owner()!==session?.user.id)){
        clear();setReload(value=>value+1);
      }
    });
    return()=>{subscription.unsubscribe();scope.current.invalidate();loadRequest.current?.abort();saveRequest.current?.abort();};
  },[]);
  useEffect(()=>{
    const epoch=scope.current.begin();
    const controller=new AbortController();loadRequest.current=controller;
    const current=()=>scope.current.current(epoch);
    void withHoopChatDeadline(async signal=>{
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(!current()||signal.aborted)return;
      if(sessionError)throw Error("Unable to verify your session.");
      if(!session?.user){window.location.replace("/login?returnTo=/creator-studio");return;}
      const verified=await supabase.auth.getUser(session.access_token);
      if(verified.error||!creatorStudioOwner(session.user.id,verified.data.user?.id)||!current()||signal.aborted)throw Error("Verify your account.");
      const uid=session.user.id;
      scope.current.bind(epoch,uid);
      const response=await fetch("/api/network/creator-studio",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store",signal});
      const payload=await response.json();
      if(!current()||signal.aborted)return;
      const latest=await supabase.auth.getSession();
      if(!current()||signal.aborted)return;
      if(latest.error||!creatorStudioOwner(uid,latest.data.session?.user.id))throw Error("Account changed.");
      if(!response.ok||!creatorStudioOwner(uid,payload.profile?.id)){setError("Creator Studio is unavailable.");setLoading(false);return;}
      setUserId(uid);setAccountNormal(payload.profile.moderation_status==="normal");setProfileReady(true);
      if(payload.creator){
        const value=payload.creator.category;
        if(categoryOptions.some(([key])=>key===value))setCategory(value as Category);
        setPublicName(payload.creator.public_name||"");setCountry(payload.creator.country||"");
        setHeadline(payload.creator.headline||"");setDescription(payload.creator.description||"");
        setWebsite(payload.creator.website_url||"");setPublished(Boolean(payload.creator.is_published));
      }
      setLoading(false);
    },15000,controller).catch(()=>{if(current()){setError("Could not open Creator Studio. Refresh to retry.");setLoading(false);}});
    return()=>{scope.current.invalidate();controller.abort();};
  },[reload]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!userId||!profileReady||saving||saveLock.current!==null)return;
    const epoch=scope.current.epoch();
    const current=()=>scope.current.current(epoch,userId);
    if(!current())return;
    setNotice("");setError("");
    const url=website.trim();
    if(url&&!validHttps(url)){setError("Website must be a valid https:// address without embedded login details.");return;}
    if(published&&publicName.trim().length<2){setError("Choose a public name for the creator directory.");return;}
    if(headline.trim().length>140||description.trim().length>600){setError("Keep your headline under 140 characters and description under 600.");return;}
    saveLock.current=epoch;setSaving(true);
    const controller=new AbortController();saveRequest.current=controller;
    try{
      const result=await withHoopChatDeadline(async signal=>{
        const {data:{session},error:sessionError}=await supabase.auth.getSession();
        if(sessionError||!session?.access_token||!creatorStudioOwner(userId,session.user.id)||!current()||signal.aborted)throw Error("Sign in again.");
        const verified=await supabase.auth.getUser(session.access_token);
        if(verified.error||!creatorStudioOwner(userId,verified.data.user?.id)||!current()||signal.aborted)throw Error("Account changed.");
        const response=await fetch("/api/network/creator-studio",{
          method:"PUT",cache:"no-store",signal,
          headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
          body:JSON.stringify({public_name:publicName.trim(),country:country.trim(),category,headline:headline.trim(),description:description.trim(),website_url:url||null,is_published:published})
        });
        const payload=await response.json();
        if(!response.ok||payload.ok!==true)throw Error("Unable to confirm creator showcase.");
        return payload;
      },15000,controller);
      if(current())setNotice(published?(result.publicly_visible?"Creator showcase published.":"Your showcase was saved, but a moderation hold prevents public discovery."):"Creator draft saved privately.");
    }catch{if(current())setError("Could not confirm your creator profile save. Refresh before retrying.");}
    finally{if(saveLock.current===epoch)saveLock.current=null;if(current())setSaving(false);}

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
          <label htmlFor="hc-creator-name">Public creator name · {publicName.length}/80</label>
          <input id="hc-creator-name" maxLength={80} value={publicName} onChange={e=>setPublicName(e.target.value)} placeholder="Your creator or media name"/>
          <label htmlFor="hc-creator-country">Public country (optional) · {country.length}/80</label>
          <input id="hc-creator-country" maxLength={80} value={country} onChange={e=>setCountry(e.target.value)} placeholder="Country you choose to share"/>
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
            <label htmlFor="hc-creator-published">Publish the public name, country, category, biography and website I entered here. No private account name, profile picture or location is copied to this showcase.</label>
          </div>
          {!accountNormal&&<p>Publishing is unavailable while your account has a moderation restriction. You can keep this as a draft.</p>}
          <p>Publishing does not grant verified status, special posting permissions, or access to paid content. All existing membership and community rules still apply.</p>
          <div className="hc-creator-actions"><button type="submit" disabled={saving}>{saving?"Saving…":"Save creator profile"}</button><Link className="hc-network-ghost" href="/creators">Creator network</Link></div>
          {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
        </section>
      </form>}
  </main>;
}
