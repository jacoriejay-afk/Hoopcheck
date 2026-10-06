"use client";

import {useState} from "react";
import Link from "next/link";
import {supabase} from "../../lib/supabase";

type InquiryType="sponsor"|"donate"|"inquire";

export default function Support(){
 const [subject,setSubject]=useState(""); const [body,setBody]=useState(""); const [type,setType]=useState<InquiryType>("inquire"); const [msg,setMsg]=useState("");
 async function submit(){
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){location.href="/login";return}
   const message=(subject.trim()?subject.trim()+"\n\n":"")+body.trim();
   if(!message.trim()){setMsg("Please add a message.");return}
   const table=type==="inquire"?"support_requests":"sponsor_inquiries";
   const payload=type==="inquire"?{user_id:user.id,subject:subject.trim().slice(0,120),body:body.trim().slice(0,3000)}:{user_id:user.id,type,message:message.slice(0,4000)};
   const {error}=await supabase.from(table).insert(payload);
   setMsg(error?error.message:(type==="sponsor"?"Sponsor inquiry sent.":type==="donate"?"Donation inquiry sent.":"Support request sent."));
   if(!error){setSubject("");setBody("")}
 }
 return <main className="page-shell"><div className="page-container">
  <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/settings">Settings</Link><Link href="/account">Profile</Link></nav></header>
  <section className="hero-card"><p className="eyebrow">HELP & SUPPORT</p><h1>How can we help?</h1><p className="muted">Account help, verification questions, reports, memberships, sponsorships, donations, or anything else about HoopCheck.</p></section>
  <section className="grid" style={{marginTop:18}}>
   {[["sponsor","Sponsor HoopCheck","Recommend a sponsor, partnership, brand opportunity, or athlete/community collaboration."],["donate","Donate / Support","Tell us you want to support the platform or help fund basketball community access."],["inquire","Contact Support","Get help with your account, verification, reports, billing, or the database."]].map(([v,t,d])=><button key={v} type="button" onClick={()=>setType(v as InquiryType)} className="dashboard-card" style={{textAlign:"left",cursor:"pointer",border:type===v?"2px solid var(--orange)":"1px solid var(--border)"}}><span className="card-kicker">{type===v?"✓ SELECTED":"CONTACT"}</span><h2>{t}</h2><p className="muted">{d}</p></button>)}
  </section>
  <section className="dashboard-card" style={{marginTop:18,display:"grid",gap:12}}>
   <p className="eyebrow">{type==="sponsor"?"SPONSOR INQUIRY":type==="donate"?"DONATE / SUPPORT":"SUPPORT REQUEST"}</p>
   <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={120}/></label>
   <label>Message<textarea value={body} onChange={e=>setBody(e.target.value)} rows={7} maxLength={3000}/></label>
   <button className="btn" onClick={submit}>Send {type==="sponsor"?"Inquiry":type==="donate"?"Request":"Support Request"}</button>
   {msg&&<p className="muted">{msg}</p>}
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link href="/membership" className="btn dark">Membership Help</Link><Link href="/verification" className="btn dark">Verification</Link><Link href="/community-guidelines" className="btn dark">Community Guidelines</Link></div>
  </section>
 </div></main>
}
