"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import WatchButton from "../../components/WatchButton";
import ActivityWire from "../../components/ActivityWire";
import { HoopIcon } from "../../components/HoopCheckUI";

type Notice={id:string;target_type:"team"|"coach"|"league"|"game";target_id:string;notification_type:"review"|"rating"|"update"|"trust_score"|"roster_spot"|"pay_warning"|"game_reminder";title:string;body:string;read_at:string|null;created_at:string};

export default function NotificationsPage(){
  const [items,setItems]=useState<Notice[]>([]);
  const [loading,setLoading]=useState(true);
  const [errorMessage,setErrorMessage]=useState("");
  const [loadFailed,setLoadFailed]=useState(false);
  const [marking,setMarking]=useState(false);
  const [retryKey,setRetryKey]=useState(0);
  const [filter,setFilter]=useState<"all"|"games"|"clubs"|"reviews"|"unread">("all");
  useEffect(()=>{
    let active=true;
    async function loadAlerts(){
      setLoading(true);setErrorMessage("");setLoadFailed(false);setItems([]);
      try{
        const {data:{session},error:sessionError}=await supabase.auth.getSession();
        if(!active)return;
        if(sessionError)throw sessionError;
        const user=session?.user;
        if(!user){window.location.href="/login";return;}
        const {data,error}=await supabase.from("notifications").select("id,target_type,target_id,notification_type,title,body,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
        if(!active)return;
        if(error)throw error;
        setItems(data||[]);
      }catch(error){
        console.error("Unable to load HoopCheck alerts:",error);
        if(active){setItems([]);setErrorMessage("Alerts could not be loaded. Please try again.");setLoadFailed(true);}
      }finally{if(active)setLoading(false);}
    }
    void loadAlerts();
    return ()=>{active=false;};
  },[retryKey]);
  async function markAll(){
    if(marking||loadFailed)return;
    setMarking(true);setErrorMessage("");
    try{
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(sessionError)throw sessionError;
      const user=session?.user;
      if(!user){setErrorMessage("Your session has expired. Please sign in again.");return;}
      const now=new Date().toISOString();
      const {error}=await supabase.from("notifications").update({read_at:now}).eq("user_id",user.id).is("read_at",null);
      if(error)throw error;
      setItems(v=>v.map(n=>({...n,read_at:n.read_at||now})));
    }catch(error){console.error("Unable to mark HoopCheck alerts as read:",error);setErrorMessage("Could not mark alerts as read. Please retry.");}
    finally{setMarking(false);}
  }
  const filtered=items.filter(n=>filter==="all" || (filter==="unread"&&!n.read_at) || (filter==="games"&&n.target_type==="game") || (filter==="clubs"&&n.target_type!=="game"&&!["review","rating","trust_score","pay_warning"].includes(n.notification_type)) || (filter==="reviews"&&["review","rating","trust_score","pay_warning"].includes(n.notification_type)));
  if(loading)return <main className="page-shell hc-notifications-page"><div className="page-container"><HoopLoading label="Loading notifications..." /></div></main>;
  return <main className="page-shell hc-notifications-page"><div className="page-container">
    <section className="hero-card" style={{marginTop:20}}><p className="eyebrow">NOTIFICATIONS</p><h1>Activity & Inbox</h1><div className="hc-alerts-inbox-links" aria-label="Activity and messages"><Link href="/notifications" aria-current="page">Activity</Link><Link href="/connections">Messages / Inbox</Link></div><p className="muted">Only teams, coaches, and leagues you manually follow can send you review, rating, or update alerts.</p><button className="btn dark" type="button" onClick={markAll} disabled={marking||loadFailed||!items.some(n=>!n.read_at)}>{marking?"Updating…":"Mark all as read"}</button></section>
    {errorMessage&&<div role="alert" className="hc-smooth-inbox-error"><span>{errorMessage}</span> {loadFailed&&<button type="button" onClick={()=>setRetryKey(v=>v+1)}>Retry loading alerts</button>}</div>}
    {!loadFailed&&<ActivityWire items={items}/>}
    {!loadFailed&&<nav className="hc-smooth-inbox-tabs hc-liquid-glass-filter" aria-label="Filter alerts">{([["all","All"],["unread","Unread"],["games","Games"],["clubs","Clubs"],["reviews","Reviews"]] as const).map(([key,label])=><button key={key} type="button" aria-pressed={filter===key} className={filter===key?"is-active":""} onClick={()=>setFilter(key)}>{label}<span>{items.filter(n=>key==="all" || (key==="unread"&&!n.read_at) || (key==="games"&&n.target_type==="game") || (key==="clubs"&&n.target_type!=="game"&&!["review","rating","trust_score","pay_warning"].includes(n.notification_type)) || (key==="reviews"&&["review","rating","trust_score","pay_warning"].includes(n.notification_type))).length}</span></button>)}</nav>}
    {!loadFailed&&<section style={{marginTop:12,display:"grid",gap:10}}>
      {filtered.length ? filtered.map(n => {
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
          {n.target_type !== "game" && <div className="hc-alert-card__controls"><WatchButton targetType={n.target_type} targetId={n.target_id} targetName={n.title} /></div>}
        </article>;
      }) : <div className="card"><h2>{items.length ? "Nothing in this category" : "No notifications yet"}</h2><p className="muted">{items.length ? "Choose another filter to see more alerts." : "Follow a team and choose the alerts you want to receive."}</p>{!items.length&&<Link href="/teams" className="btn">Find Teams</Link>}</div>}
    </section>}
  </div></main>;
}
