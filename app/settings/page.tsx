"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Theme = "light" | "dark" | "dynamic";

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>("dynamic");
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const local = localStorage.getItem("hoopcheck-theme") as Theme | null;
    if (local) setTheme(local);
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prefs } = await supabase.from("user_preferences").select("theme,notifications_enabled").eq("user_id", data.user.id).maybeSingle();
      if (prefs?.theme) setTheme(prefs.theme as Theme);
      if (typeof prefs?.notifications_enabled === "boolean") setNotifications(prefs.notifications_enabled);
    });
  }, []);

  async function save(nextTheme = theme, nextNotifications = notifications) {
    setSaving(true);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("hoopcheck-theme", nextTheme);
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.from("user_preferences").upsert({ user_id: userData.user.id, theme: nextTheme, notifications_enabled: nextNotifications, updated_at: new Date().toISOString() });
    }
    setSaving(false);
  }

  return (
    <main className="settings-page">
      <header className="topbar settings-topbar">
        <Link href="/dashboard" className="brand">HOOPCHECK</Link>
        <nav className="topnav"><Link href="/dashboard">Dashboard</Link><Link href="/search">Search</Link><Link href="/account">Account</Link></nav>
      </header>
      <section className="settings-shell">
        <div className="eyebrow">CONTROL CENTER</div>
        <h1>Settings</h1>
        <p className="muted">Tune the HoopCheck experience to match how you research the basketball world.</p>
        <div className="settings-grid">
          <section className="settings-card">
            <span className="card-kicker">VISUAL MODE</span>
            <h2>Choose your atmosphere</h2>
            <div className="theme-options">
              {(["dynamic","dark","light"] as Theme[]).map((option) => (
                <button key={option} className={"theme-option " + (theme === option ? "active" : "")} onClick={() => { setTheme(option); save(option, notifications); }} type="button">
                  <strong>{option === "dynamic" ? "Dynamic" : option === "dark" ? "Dark Mode" : "Light Mode"}</strong>
                  <small>{option === "dynamic" ? "Adaptive charcoal + orange" : option === "dark" ? "Asphalt black" : "Clean hardwood"}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="settings-card">
            <span className="card-kicker">NOTIFICATIONS</span>
            <h2>Basketball alerts</h2>
            <p className="muted">Follow specific teams, coaches, or leagues to keep their alerts one tap away.</p>
            <button type="button" className={"toggle " + (notifications ? "on" : "")} onClick={() => { const next = !notifications; setNotifications(next); save(theme, next); }}>
              <span />{notifications ? "Notifications enabled" : "Notifications disabled"}
            </button>
            <Link href="/search" className="btn dark">Find something to follow</Link>
          </section>
          <section className="settings-card">
            <span className="card-kicker">MOTION</span>
            <h2>Mobile-smooth interactions</h2>
            <p className="muted">Animations are short, touch-friendly, and respect your device&apos;s reduced-motion preference.</p>
            <div className="motion-demo"><span /><span /><span /></div>
          </section>
        </div>
        <p className="settings-save">{saving ? "Saving..." : "Settings saved automatically."}</p>
      </section>
    </main>
  );
}
