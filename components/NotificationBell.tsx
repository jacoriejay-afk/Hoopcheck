"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Watch = { id: string; target_type: "team" | "coach" | "league"; target_id: string; notify: boolean };

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase.from("user_watchlists").select("id,target_type,target_id,notify").eq("user_id", userData.user.id).order("created_at", { ascending: false });
    const rows = (data || []) as Watch[];
    setWatches(rows);
    const map: Record<string, string> = {};
    const ids = (type: Watch["target_type"]) => rows.filter((r) => r.target_type === type).map((r) => r.target_id);
    const [teams, coaches, leagues] = await Promise.all([
      ids("team").length ? supabase.from("teams").select("id,name").in("id", ids("team")) : Promise.resolve({ data: [] as {id:string;name:string}[] }),
      ids("coach").length ? supabase.from("coaches").select("id,name").in("id", ids("coach")) : Promise.resolve({ data: [] as {id:string;name:string}[] }),
      ids("league").length ? supabase.from("leagues").select("id,name").in("id", ids("league")) : Promise.resolve({ data: [] as {id:string;name:string}[] }),
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

  return (
    <div className="notification-wrap" ref={ref}>
      <button className="notification-button" type="button" aria-label="Notifications" onClick={() => { setOpen((v) => !v); load(); }}>
        <span aria-hidden="true">◉</span>
        {watches.length > 0 && <b>{watches.length}</b>}
      </button>
      {open && (
        <div className="notification-panel">
          <div className="notification-panel-head"><strong>ALERTS</strong><a href="/settings">Settings</a></div>
          {watches.length === 0 ? (
            <p className="muted">Follow a team, coach, or league to get alerts here.</p>
          ) : watches.slice(0, 8).map((watch) => {
            const path = watch.target_type === "team" ? "teams" : watch.target_type === "coach" ? "coaches" : "leagues";
            return <a key={watch.id} href={"/" + path + "/" + watch.target_id} className="notification-item"><span>{watch.target_type.toUpperCase()}</span><strong>{names[watch.target_id] || "Basketball organization"}</strong><small>{watch.notify ? "Alerts on" : "Saved"}</small></a>;
          })}
        </div>
      )}
    </div>
  );
}
