"use client";
import { useEffect, useState } from "react";
import Logo from "../../../components/Logo";
import Link from "next/link";

import { supabase } from "../../../lib/supabase";

const labels: Record<string,string> = {
  users_total:"Users",
  players_total:"Players",
  verified_players:"Verified Players",
  paying_users:"Paying Users",
  pro_users:"Pro Subscribers",
  premium_users:"Premium Subscribers",
  reviews_total:"Reviews",
  reviews_pending:"Pending Reviews",
  reviews_legal_review:"Legal Review Flags",
  teams_active:"Active Teams",
  leagues_active:"Active Leagues",
  feed_posts_24h:"Live Feed Posts",
  open_tickets:"Open Tickets",
  active_users_7d:"Active Users · 7d",
  new_users_7d:"New Users · 7d",
  new_reviews_7d:"New Reviews · 7d",
};

export default function AdminAnalyticsPage(){
  const [kpis,setKpis]=useState<Record<string,number>|null>(null);
  const [error,setError]=useState("");
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const { data, error } = await supabase.rpc("get_hoopcheck_kpis");
        if (error) throw error;
        if (active) {
          setKpis((data || {}) as Record<string, number>);
          setError("");
        }
      } catch (error) {
        console.error("Unable to load HoopCheck analytics:", error);
        if (active) setError(error instanceof Error ? error.message : "Unable to load analytics right now.");
      }
    })();

    return () => { active = false; };
  }, []);
  return <main className="page-shell admin-light-shell"><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/admin/users">Users</Link><Link href="/admin/reviews">Reviews</Link><Link href="/admin/support">Support</Link></nav></header>
    <section className="hero-card"><div><p className="eyebrow">FOUNDER ANALYTICS</p><h1>HoopCheck KPI Dashboard</h1><p className="muted">Your operating dashboard for growth, subscriptions, reviews, safety, content and support.</p></div></section>
    {error?<div className="message error" style={{marginTop:18}}>{error}</div>:<section className="grid" style={{marginTop:18}}>{Object.entries(labels).map(([key,label])=><article className="dashboard-card" key={key}><p className="eyebrow">{label}</p><strong style={{fontSize:34}}>{kpis?.[key] ?? "—"}</strong></article>)}</section>}
    <section className="dashboard-card" style={{marginTop:18}}><p className="eyebrow">FOUNDER ACTIONS</p><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link href="/admin/support" className="btn">Open Support</Link><Link href="/admin/reviews" className="btn dark">Moderate Reviews</Link><Link href="/admin/users" className="btn dark">Manage Users</Link></div></section>
  </div></main>;
}
