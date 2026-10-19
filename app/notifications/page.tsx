"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import WatchButton from "../../components/WatchButton";
import { HoopIcon } from "../../components/HoopCheckUI";

type Notice={id:string;target_type:"team"|"coach"|"league"|"game";target_id:string;notification_type:"review"|"rating"|"update"|"trust_score"|"roster_spot"|"pay_warning"|"game_reminder";title:string;body:string;read_at:string|null;created_at:string};

export default function NotificationsPage(){
  const [items,setItems]=useState<Notice[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    const user=session?.user;
    if(!user){window.location.href="/login";return;}
    const {data}=await supabase.from("notifications").select("id,target_type,target_id,notification_type,title,body,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
    setItems(data||[]);setLoading(false);
  })()},[]);
  async function markAll(){
    const {data:{session}}=await supabase.auth.getSession();
    const user=session?.user;
    if(!user)return;
    const now=new Date().toISOString();
    await supabase.from("notifications").update({read_at:now}).eq("user_id",user.id).is("read_at",null);
    setItems(v=>v.map(n=>({...n,read_at:n.read_at||now})));
  }
  if(loading)return <main className="page-shell hc-notifications-page"><div className="page-container"><HoopLoading label="Loading notifications..." /></div></main>;
  return <main className="page-shell hc-notifications-page"><div className="page-container">
    <section className="hero-card" style={{marginTop:20}}><p className="eyebrow">NOTIFICATIONS</p><h1>Alerts</h1><p className="muted">Only teams, coaches, and leagues you manually follow can send you review, rating, or update alerts.</p><button className="btn dark" type="button" onClick={markAll}>Mark all as read</button></section>
    <section style={{marginTop:24,display:"grid",gap:10}}>
      {items.length ? items.map(n => {
        const path = n.target_type === "team" ? "teams" : n.target_type === "coach" ? "coaches" : n.target_type === "game" ? "fan-live?gameId=" + n.target_id : "leagues";
        const href = n.target_type === "game" ? "/" + path : "/" + path + "/" + n.target_id;
        const meta: Record<string, { label: string; icon: "message-square" | "star" | "external-link" | "shield-check" | "users" | "whistle" | "bell" }> = {
          review: { label: "NEW REVIEW", icon: "message-square" },
          rating: { label: "NEW RATING", icon: "star" },
          update: { label: "PROFILE UPDATE", icon: "external-link" },
          trust_score: { label: "TRUST SCORE CHANGE", icon: "shield-check" },
          roster_spot: { label: "ROSTER SPOT", icon: "users" },
          pay_warning: { label: "PAY WARNING", icon: "whistle" },
          game_reminder: { label: "GAME REMINDER", icon: "bell" },
        };
        const item = meta[n.notification_type] || meta.update;
        return <article key={n.id} className={"hc-alert-card " + (!n.read_at ? "unread" : "")}>
          <Link href={href} className="hc-alert-card__main">
            <span className={"hc-alert-type hc-alert-type--" + n.notification_type}><HoopIcon name={item.icon} size={14} />{item.label} · {new Date(n.created_at).toLocaleString()}</span>
            <strong>{n.title}</strong><small>{n.body}</small>
          </Link>
          <div className="hc-alert-card__controls"><WatchButton targetType={n.target_type} targetId={n.target_id} targetName={n.title} /></div>
        </article>;
      }) : <div className="card"><h2>No notifications yet</h2><p className="muted">Follow a team and choose the alerts you want to receive.</p><Link href="/teams" className="btn">Find Teams</Link></div>}
    </section>
  </div></main>;
}
