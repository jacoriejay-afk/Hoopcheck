"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { HoopIcon, type HoopIconName } from "../../components/HoopCheckUI";
import "./home-court-space.css";

type ActionId = "hoopgroups" | "live" | "hoopfeed" | "teams" | "players" | "search" | "fans" | "alerts" | "account";
type Action = { id: ActionId; label: string; href: string; icon: HoopIconName };
type CourtPrefs = { name: string; accent: "orange" | "blue" | "purple"; actions: ActionId[] };
const DEFAULT: CourtPrefs = { name: "My Court", accent: "orange", actions: ["hoopgroups", "live", "hoopfeed", "teams"] };
const ACTIONS: Action[] = [
  { id: "hoopgroups", label: "HoopGroups", href: "/hoopgroups", icon: "users" },
  { id: "live", label: "Live Games", href: "/live-games", icon: "basketball" },
  { id: "hoopfeed", label: "HoopFeed", href: "/feed", icon: "message-square" },
  { id: "teams", label: "Check a Team", href: "/teams", icon: "shield-check" },
  { id: "players", label: "Find Players", href: "/players", icon: "user" },
  { id: "search", label: "Search", href: "/search", icon: "search" },
  { id: "fans", label: "Team Fan Groups", href: "/team-hub/groups", icon: "users" },
  { id: "alerts", label: "Alerts", href: "/notifications", icon: "bell" },
  { id: "account", label: "My Account", href: "/account", icon: "settings" },
];
const allowed = new Set<ActionId>(ACTIONS.map(action => action.id));
const accents: CourtPrefs["accent"][] = ["orange", "blue", "purple"];

function restore(raw: string | null): CourtPrefs {
  if (!raw) return DEFAULT;
  try {
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== "object") return DEFAULT;
    const record = input as Partial<CourtPrefs>;
    const actions = Array.isArray(record.actions)
      ? [...new Set(record.actions.filter((id): id is ActionId => typeof id === "string" && allowed.has(id as ActionId)))].slice(0, 6)
      : DEFAULT.actions;
    return {
      name: typeof record.name === "string" ? record.name.slice(0, 36) : DEFAULT.name,
      accent: accents.includes(record.accent as CourtPrefs["accent"]) ? record.accent as CourtPrefs["accent"] : "orange",
      actions: actions.length ? actions : DEFAULT.actions,
    };
  } catch { return DEFAULT; }
}

export default function HomeCourtSpace({ profileId, hasFeedAccess }: { profileId: string; hasFeedAccess: boolean }) {
  const [prefs, setPrefs] = useState<CourtPrefs>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!profileId) return;
    try { setPrefs(restore(window.localStorage.getItem("hc-court-v1:" + profileId))); }
    catch { setPrefs(DEFAULT); }
    setReady(true);
  }, [profileId]);
  useEffect(() => {
    if (!ready || !profileId) return;
    try { window.localStorage.setItem("hc-court-v1:" + profileId, JSON.stringify(prefs)); }
    catch { /* Private browsing can disable storage; keep the session usable. */ }
  }, [ready, profileId, prefs]);

  function toggle(id: ActionId) {
    setPrefs(current => {
      const exists = current.actions.includes(id);
      if (!exists && current.actions.length >= 6) return current;
      if (exists && current.actions.length <= 1) return current;
      return { ...current, actions: exists ? current.actions.filter(item => item !== id) : [...current.actions, id] };
    });
  }
  function move(id: ActionId, offset: number) {
    setPrefs(current => {
      const actions = [...current.actions];
      const from = actions.indexOf(id);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= actions.length) return current;
      [actions[from], actions[to]] = [actions[to], actions[from]];
      return { ...current, actions };
    });
  }

  const selected = prefs.actions.map(id => ACTIONS.find(action => action.id === id)).filter((action): action is Action => Boolean(action));
  return <section className="hc-court" style={{ "--hc-court-accent": prefs.accent === "blue" ? "#2563eb" : prefs.accent === "purple" ? "#7c3aed" : "#f65b21" } as CSSProperties} aria-label="Personalized Home Court Space">
    <header className="hc-court-head">
      <div><span className="hc-court-kicker">COURT SPACE</span><h2>{prefs.name.trim() || "My Court"}</h2></div>
      <button type="button" onClick={() => setEditing(value => !value)} aria-expanded={editing} aria-controls="hc-court-editor">
        <HoopIcon name={editing ? "x" : "settings"} size={16}/> {editing ? "Done" : "Customize"}
      </button>
    </header>
    <Link href="/hoopgroups" className="hc-court-feature">
      <span className="hc-court-feature-icon"><HoopIcon name="users" size={23}/></span>
      <span><strong>HoopGroups</strong><small>Explore basketball communities, channels & conversations</small></span>
      <HoopIcon name="arrow-right" size={19}/>
    </Link>
    <div className="hc-court-quick-heading">QUICK ACTIONS <small>{selected.length} pinned</small></div>
    <nav className="hc-court-actions" aria-label="My Court quick actions">
      {selected.map(action => <Link key={action.id} href={action.id === "hoopfeed" && !hasFeedAccess ? "/membership" : action.href}>
        <HoopIcon name={action.icon} size={21}/><span>{action.id === "hoopfeed" && !hasFeedAccess ? "Unlock HoopFeed" : action.label}</span>
      </Link>)}
    </nav>
    {editing && <div id="hc-court-editor" className="hc-court-editor">
      <label>Rename Court Space <input maxLength={36} value={prefs.name} onChange={event => setPrefs(current => ({...current, name: event.target.value}))} placeholder="My Court"/></label>
      <fieldset><legend>Accent color</legend><div className="hc-court-color-choices">{accents.map(accent => <label key={accent}><input type="radio" name="court-accent" value={accent} checked={prefs.accent === accent} onChange={() => setPrefs(current => ({...current, accent}))}/><span className={"hc-court-swatch hc-court-swatch--" + accent}/>{accent}</label>)}</div></fieldset>
      <fieldset><legend>Quick actions (choose 1–6 and change their order)</legend><div className="hc-court-options">{ACTIONS.map(action => {
        const index = prefs.actions.indexOf(action.id);
        const active = index >= 0;
        return <div className="hc-court-option" key={action.id}>
          <label><input type="checkbox" checked={active} disabled={active ? prefs.actions.length <= 1 : prefs.actions.length >= 6} onChange={() => toggle(action.id)}/>{action.label}</label>
          {active && <div><button type="button" aria-label={"Move " + action.label + " earlier"} disabled={index === 0} onClick={() => move(action.id, -1)}>↑</button><button type="button" aria-label={"Move " + action.label + " later"} disabled={index === prefs.actions.length - 1} onClick={() => move(action.id, 1)}>↓</button></div>}
        </div>;
      })}</div></fieldset>
      <div className="hc-court-editor-footer"><small>Preferences are saved on this device for your account.</small><button type="button" onClick={() => setPrefs(DEFAULT)}>Reset Court</button></div>
    </div>}
  </section>;
}
