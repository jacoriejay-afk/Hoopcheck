"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Ticket={id:string;subject:string;category:string;priority:string;status:string;description:string;created_at:string};

export default function SupportPage(){
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [subject,setSubject]=useState("");
 const [category,setCategory]=useState("general");
 const [priority,setPriority]=useState("normal");
 const [description,setDescription]=useState("");
 const [message,setMessage]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);

 async function load(){
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){window.location.href="/login";return;}
   const {data}=await supabase.from("support_tickets").select("id,subject,category,priority,status,description,created_at").eq("requester_id",user.id).order("created_at",{ascending:false});
   setTickets((data||[]) as Ticket[]);setLoading(false);
 }
 useEffect(()=>{void load();},[]);

 async function submit(e:React.FormEvent){
   e.preventDefault();setSaving(true);setMessage("");
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){window.location.href="/login";return;}
   const {error}=await supabase.from("support_tickets").insert({requester_id:user.id,subject:subject.trim(),category,priority,description:description.trim()});
   if(error)setMessage(error.message);else{setSubject("");setDescription("");setPriority("normal");setMessage("Ticket submitted. Your ticket is now in the HoopCheck support queue.");await load();}
   setSaving(false);
 }

 return <main className="page-shell"><div className="page-container">
   <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/dashboard">Dashboard</Link><Link href="/profile">Profile</Link></nav></header>
   <section className="hero-card"><div><p className="eyebrow">HOOPCHECK SUPPORT</p><h1>Open a support ticket.</h1><p className="muted">Email: <a href="mailto:HoopCheck@outlook.com">HoopCheck@outlook.com</a>. Tickets create a trackable record for account, billing, verification, review, privacy, security, technical and team-directory issues.</p></div></section>
   <section className="dashboard-card" style={{marginTop:18}}><p className="eyebrow">NEW TICKET</p><form onSubmit={submit} className="signup-form">
    <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} minLength={3} maxLength={160} required/></label>
    <div className="signup-two-col"><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{["account","billing","verification","review","privacy","security","technical","team_request","general"].map(x=><option key={x} value={x}>{x.replace("_"," ")}</option>)}</select></label><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div>
    <label>Describe the issue<textarea value={description} onChange={e=>setDescription(e.target.value)} minLength={10} maxLength={5000} rows={7} required/></label>
    {message&&<div className="message">{message}</div>}<button className="btn" disabled={saving}>{saving?"Submitting...":"Submit Ticket"}</button>
   </form></section>
   <section className="dashboard-card" style={{marginTop:18}}><p className="eyebrow">MY TICKETS</p>{loading?<p className="muted">Loading...</p>:tickets.length===0?<p className="muted">No tickets yet.</p>:<div className="grid" style={{padding:"10px 0 0"}}>{tickets.map(t=><article className="card" key={t.id}><div className="eyebrow">{t.status} · {t.priority}</div><h3>{t.subject}</h3><p className="muted">{t.category}</p><p>{t.description}</p><small className="muted">{new Date(t.created_at).toLocaleString()}</small></article>)}</div>}</section>
 </div></main>;
}
