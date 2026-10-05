"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";

type Notice={id:string;target_type:"team"|"coach"|"league";target_id:string;notification_type:"review"|"rating"|"update";title:string;body:string;read_at:string|null;created_at:string};

export default function NotificationsPage(){
  const [items,setItems]=useState<Notice[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{
    const {data:user}=await supabase.auth.getUser();
    if(!user.user){window.location.href="/login";return;}
    const {data}=await supabase.from("notifications").select("id,target_type,target_id,notification_type,title,body,read_at,created_at").eq("user_id",user.user.id).order("created_at",{ascending:false}).limit(100);
    setItems(data||[]);setLoading(false);
  })()},[]);
  async function markAll(){
    const {data:user}=await supabase.auth.getUser();
    if(!user.user)return;
    const now=new Date().toISOString();
    await supabase.from("notifications").update({read_at:now}).eq("user_id",user.user.id).is("read_at",null);
    setItems(v=>v.map(n=>({...n,read_at:n.read_at||now})));
  }
  if(loading)return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading notifications..." /></div></main>;
  return <main className="page-shell"><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/dashboard">Dashboard</Link><Link href="/settings">Settings</Link></nav></header>
    <section className="hero-card" style={{marginTop:20}}><p className="eyebrow">NOTIFICATIONS</p><h1>Alerts</h1><p className="muted">Only teams, coaches, and leagues you manually follow can send you review, rating, or update alerts.</p><button className="btn dark" type="button" onClick={markAll}>Mark all as read</button></section>
    <section style={{marginTop:24,display:"grid",gap:10}}>
      {items.length?items.map(n=>{const path=n.target_type==="team"?"teams":n.target_type==="coach"?"coaches":"leagues";return <Link key={n.id} href={`/${path}/${n.target_id}`} className={"notification-item "+(!n.read_at?"unread":"")}><span>{n.notification_type.toUpperCase()} · {new Date(n.created_at).toLocaleString()}</span><strong>{n.title}</strong><small>{n.body}</small></Link>}):<div className="card"><h2>No notifications yet</h2><p className="muted">Manually follow an organization and choose the alerts you want.</p><Link href="/search" className="btn">Find Teams & Leagues</Link></div>}
    </section>
  </div></main>;
}
