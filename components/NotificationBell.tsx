"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {readNotifications,markNotificationsRead,verifiedAlertSession,withAlertDeadline,notificationPath} from "../apps/mobile/src/native/notifications";

type Watch = { id: string; target_type: "team" | "coach" | "league"; target_id: string; notify: boolean; follow: boolean };
type Notice = { id: string; target_type: Watch["target_type"]; target_id: string; notification_type: "review" | "rating" | "update"; title: string; body: string; read_at: string | null; created_at: string };

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);

  const generation=useRef(0),owner=useRef<string|null>(null),marking=useRef(false);
  function clear(){owner.current=null;setNotices([]);setWatches([]);setNames({});}
  async function load(){
    const rev=++generation.current;
    clear();
    try{
      const result=await withAlertDeadline(async signal=>{
        const scope=await verifiedAlertSession(supabase,signal);
        if(rev!==generation.current)throw Error("Account changed.");
        const [watchData,alerts]=await Promise.all([
          supabase.from("user_watchlists").select("id,target_type,target_id,notify,follow").eq("user_id",scope.uid).order("created_at",{ascending:false}).limit(100).setHeader("Authorization",scope.bearer).abortSignal(signal),
          readNotifications(supabase,scope.uid,undefined,scope)
        ]);
        if(watchData.error)throw Error("Alerts unavailable.");
        return {uid:scope.uid,rows:(watchData.data||[]) as Watch[],alerts:alerts.slice(0,12) as Notice[]};
      });
      if(rev!==generation.current)return;
      owner.current=result.uid;setWatches(result.rows);setNotices(result.alerts);
      // Public labels are optional; never retain labels from another account.
    }catch{if(rev===generation.current)clear();}
  }
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event!=="SIGNED_OUT"&&!(event==="SIGNED_IN"&&session?.user.id!==owner.current))return;
      generation.current++;clear();setOpen(false);clearTimeout(timer);
      if(event!=="SIGNED_OUT")timer=setTimeout(()=>void load(),0);
    });
    void load();
    return ()=>{generation.current++;owner.current=null;clearTimeout(timer);data.subscription.unsubscribe();};
  },[]);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notices.filter((n) => !n.read_at).length;

  async function markRead(id?:string){
    const uid=owner.current,rev=generation.current;
    if(!uid||marking.current)return;
    marking.current=true;
    try{
      const result=await withAlertDeadline(async signal=>{
        const scope=await verifiedAlertSession(supabase,signal,uid);
        if(rev!==generation.current||owner.current!==uid)throw Error("Account changed.");
        return markNotificationsRead(supabase,uid,new Date(),id,scope);
      });
      if(rev===generation.current&&owner.current===uid)setNotices(items=>items.map(n=>result.ids.includes(n.id)?{...n,read_at:n.read_at||result.readAt}:n));
    }catch{/* Keep unconfirmed read state. Full Alerts has retry. */}
    finally{marking.current=false;}
  }

  return (
    <div className="notification-wrap" ref={ref}>
      <button className="notification-button" type="button" aria-label="Notifications" onClick={() => { setOpen((v) => !v); load(); }}>
        <span aria-hidden="true">◉</span>
        {unread > 0 && <b>{unread}</b>}
      </button>
      {open && (
        <div className="notification-panel">
          <div className="notification-panel-head"><strong>NOTIFICATIONS</strong><span style={{display:"flex",gap:10}}>{unread > 0 && <button type="button" onClick={()=>void markRead()}>Mark all read</button>}<a href="/notifications">View all</a><a href="/settings">Settings</a></span></div>
          {notices.length > 0 && <div className="notification-section-title">NEW</div>}
          {notices.slice(0, 8).map((notice) => {
            const path=notificationPath(notice);
            return <a key={notice.id} href={path||"/notifications"} onClick={() => void markRead(notice.id)} className={"notification-item " + (!notice.read_at ? "unread" : "")}><span>{notice.notification_type.toUpperCase()}</span><strong>{notice.title}</strong><small>{notice.body}</small></a>;
          })}
          <div className="notification-section-title">FOLLOWING</div>
          {watches.filter((w) => w.follow).slice(0, 8).map((watch) => {
            const path = watch.target_type === "team" ? "teams" : watch.target_type === "coach" ? "coaches" : "leagues";
            return <a key={watch.id} href={"/" + path + "/" + watch.target_id} className="notification-item"><span>{watch.target_type.toUpperCase()}</span><strong>{names[watch.target_id] || "Basketball organization"}</strong><small>{watch.notify ? "Alerts on" : "Following"}</small></a>;
          })}
          {!notices.length && !watches.filter((w) => w.follow).length && <p className="muted">Follow a team, coach, or league manually. Alerts only come from organizations you choose to follow.</p>}
        </div>
      )}
    </div>
  );
}
