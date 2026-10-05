"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Watch = { id: string; target_type: "team" | "coach" | "league"; target_id: string; notify: boolean; follow: boolean };
type Notice = { id: string; target_type: Watch["target_type"]; target_id: string; notification_type: "review" | "rating" | "update"; title: string; body: string; read_at: string | null; created_at: string };

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const [{ data: watchData }, { data: noticeData }] = await Promise.all([
      supabase.from("user_watchlists").select("id,target_type,target_id,notify,follow").eq("user_id", userData.user.id).order("created_at", { ascending: false }),
      supabase.from("notifications").select("id,target_type,target_id,notification_type,title,body,read_at,created_at").eq("user_id", userData.user.id).order("created_at", { ascending: false }).limit(12),
    ]);
    const rows = (watchData || []) as Watch[];
    const alerts = (noticeData || []) as Notice[];
    setWatches(rows);
    setNotices(alerts);
    const map: Record<string, string> = {};
    const ids = (type: Watch["target_type"]) => rows.filter((r) => r.target_type === type).map((r) => r.target_id);
    const noticeIds = (type: Watch["target_type"]) => alerts.filter((r) => r.target_type === type).map((r) => r.target_id);
    const [teams, coaches, leagues] = await Promise.all([
      [...new Set([...ids("team"), ...noticeIds("team")])].length ? supabase.from("teams").select("id,name").in("id", [...new Set([...ids("team"), ...noticeIds("team")])]) : Promise.resolve({ data: [] as {id:string;name:string}[] }),
      [...new Set([...ids("coach"), ...noticeIds("coach")])].length ? supabase.from("coaches").select("id,name").in("id", [...new Set([...ids("coach"), ...noticeIds("coach")])]) : Promise.resolve({ data: [] as {id:string;name:string}[] }),
      [...new Set([...ids("league"), ...noticeIds("league")])].length ? supabase.from("leagues").select("id,name").in("id", [...new Set([...ids("league"), ...noticeIds("league")])]) : Promise.resolve({ data: [] as {id:string;name:string}[] }),
    ]);
    for (const row of [...(teams.data || []), ...(coaches.data || []), ...(leagues.data || [])]) map[row.id] = row.name;
    setNames(map);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notices.filter((n) => !n.read_at).length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setNotices((items) => items.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  return (
    <div className="notification-wrap" ref={ref}>
      <button className="notification-button" type="button" aria-label="Notifications" onClick={() => { setOpen((v) => !v); load(); }}>
        <span aria-hidden="true">◉</span>
        {(unread > 0 || watches.filter((w) => w.follow).length > 0) && <b>{unread || watches.filter((w) => w.follow).length}</b>}
      </button>
      {open && (
        <div className="notification-panel">
          <div className="notification-panel-head"><strong>ALERTS</strong><a href="/settings">Settings</a></div>
          {notices.length > 0 && <div className="notification-section-title">NEW</div>}
          {notices.slice(0, 8).map((notice) => {
            const path = notice.target_type === "team" ? "teams" : notice.target_type === "coach" ? "coaches" : "leagues";
            return <a key={notice.id} href={"/" + path + "/" + notice.target_id} onClick={() => markRead(notice.id)} className={"notification-item " + (!notice.read_at ? "unread" : "")}><span>{notice.notification_type.toUpperCase()}</span><strong>{notice.title}</strong><small>{notice.body}</small></a>;
          })}
          <div className="notification-section-title">FOLLOWING</div>
          {watches.filter((w) => w.follow).slice(0, 8).map((watch) => {
            const path = watch.target_type === "team" ? "teams" : watch.target_type === "coach" ? "coaches" : "leagues";
            return <a key={watch.id} href={"/" + path + "/" + watch.target_id} className="notification-item"><span>{watch.target_type.toUpperCase()}</span><strong>{names[watch.target_id] || "Basketball organization"}</strong><small>{watch.notify ? "Alerts on" : "Following"}</small></a>;
          })}
          {!notices.length && !watches.filter((w) => w.follow).length && <p className="muted">Follow a team, coach, or league to get alerts here.</p>}
        </div>
      )}
    </div>
  );
}
