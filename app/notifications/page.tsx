"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import WatchButton from "../../components/WatchButton";
import { HoopIcon } from "../../components/HoopCheckUI";
import HoopChatInbox from "../../components/HoopChatInbox";
import { ALERT_FILTERS, ALERT_LIST_LIMIT, matchesAlertFilter, matchesAlertSearch, type AlertFilter } from "../../lib/alert-list";
import "./notifications-threads.css";

type Notice={id:string;target_type:"team"|"coach"|"league"|"game";target_id:string;notification_type:"review"|"rating"|"update"|"trust_score"|"roster_spot"|"pay_warning"|"game_reminder";title:string;body:string;read_at:string|null;created_at:string};

export default function NotificationsPage(){
  const [items,setItems]=useState<Notice[]>([]);
  const [loading,setLoading]=useState(true);
  const [errorMessage,setErrorMessage]=useState("");
  const [loadFailed,setLoadFailed]=useState(false);
  const [marking,setMarking]=useState(false);
  const [retryKey,setRetryKey]=useState(0);
  const [filter,setFilter]=useState<AlertFilter>("all");
  const [query,setQuery]=useState("");
  const [section,setSection]=useState<"alerts"|"messages">("alerts");
  useEffect(()=>{if(new URLSearchParams(window.location.search).get("tab")==="messages")setSection("messages");},[]);
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
        const {data,error}=await supabase.from("notifications").select("id,target_type,target_id,notification_type,title,body,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(ALERT_LIST_LIMIT);
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
  const unreadCount=items.filter(n=>!n.read_at).length;
  const searched=items.filter(n=>matchesAlertSearch(n,query));
  const filtered=searched.filter(n=>matchesAlertFilter(n,filter));
  // Messages own their independent auth and query lifecycle: slow/failed Alerts must not block HoopChat.
  if(loading&&section==="alerts")return <main className="page-shell hc-notifications-page"><div className="page-container"><HoopLoading label="Loading notifications..." /></div></main>;
  return <main className="page-shell hc-notifications-page"><div className="page-container">
    <header className="hc-alerts-heading">
      <div className="hc-alerts-heading__title"><HoopIcon name="bell" size={21} /><h1>Alerts</h1>{unreadCount>0&&<span className="hc-alerts-heading__count" aria-label="Unread alerts in loaded list">{unreadCount}</span>}</div>
      {section==="alerts"&&unreadCount>0&&<button className="hc-alerts-heading__read" type="button" onClick={markAll} disabled={marking||loadFailed}>{marking?"Updating…":"Mark all read"}</button>}
    </header>
    <nav className="hc-notifications-main-tabs" aria-label="Inbox sections">
      {(["alerts","messages"] as const).map(tab=><button key={tab} type="button" aria-pressed={section===tab} onClick={()=>{
        setSection(tab);const next=new URL(window.location.href);next.searchParams.set("tab",tab);window.history.replaceState(null,"",next.pathname+next.search+next.hash);
      }}>{tab==="alerts"?"Alerts":"Messages"}</button>)}
    </nav>
    {section==="messages"&&<><div className="hc-notifications-messages-link"><span>PRIVATE HOOPCHAT</span><Link href="/messages">Open full Courtside inbox</Link></div><HoopChatInbox /></>}
    {section==="alerts"&&errorMessage&&<div role="alert" className="hc-smooth-inbox-error"><span>{errorMessage}</span> {loadFailed&&<button type="button" onClick={()=>setRetryKey(v=>v+1)}>Retry loading alerts</button>}</div>}
    {section==="alerts"&&!loadFailed&&<><div className="hc-alert-search"><label htmlFor="alert-search">Search loaded alerts</label><div><input id="alert-search" type="search" value={query} maxLength={120} placeholder="Search titles and messages" onChange={event=>setQuery(event.target.value)} />{query&&<button type="button" onClick={()=>setQuery("")}>Clear</button>}</div><small role="status">{filtered.length} matching {filtered.length===1?"alert":"alerts"} · {items.length===ALERT_LIST_LIMIT?"Latest 100 loaded; older alerts are not included.":items.length+" loaded"}</small></div>
    <nav className="hc-smooth-inbox-tabs hc-alerts-filters" aria-label="Filter alerts">{ALERT_FILTERS.map(([key,label])=><button key={key} type="button" aria-pressed={filter===key} className={filter===key?"is-active":""} onClick={()=>setFilter(key)}>{label}<span>{searched.filter(n=>matchesAlertFilter(n,key)).length}</span></button>)}</nav></>}
    {section==="alerts"&&!loadFailed&&<section className="hc-alert-list" aria-label="Basketball notifications">
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
      }) : <div className="hc-alerts-empty" role="status"><strong>{items.length?(query.trim()?"No matching alerts":"No alerts in this category"):"No notifications yet"}</strong><p>{items.length?(query.trim()?"Try another search or filter.":"Try a different filter."):"Follow a team to get updates here."}</p>{!items.length&&<Link href="/teams">Explore teams</Link>}</div>}
    </section>}
  </div></main>;
}
