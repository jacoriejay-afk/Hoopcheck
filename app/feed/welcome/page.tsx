"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Role = "player" | "fan" | "coach" | "agent" | "scout" | "club_admin" | "manager" | "guest";
const rolePrompts: Record<Role, string> = {
  player: "Share your journey, follow other players, and start a basketball discussion.",
  fan: "Follow your club, discover game conversations, and support your favorite players.",
  coach: "Introduce your coaching experience and discover the global basketball community.",
  agent: "Find talent and join conversations respectfully. Never request sensitive details in public.",
  scout: "Discover talent and participate in professional basketball discussion.",
  club_admin: "Share official club updates and connect with your supporters.",
  manager: "Share official club updates and connect with your supporters.",
  guest: "Connect with players, fans, teams, coaches, and agents around basketball.",
};

export default function HoopFeedWelcomePage() {
  const [role, setRole] = useState<Role>("guest");
  const [displayName, setDisplayName] = useState("");
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || !active) return;
      const { data: profile } = await supabase.from("profiles")
        .select("account_type,display_name").eq("id", data.user.id).maybeSingle();
      if (!active) return;
      const kind = String(profile?.account_type || "guest") as Role;
      setRole(kind in rolePrompts ? kind : "guest");
      setDisplayName(profile?.display_name || "");
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <main className="page-shell hc-feed-welcome-page"><div className="page-container">
    <section className="hero-card hc-feed-welcome-hero">
      <p className="eyebrow">HOOPFEED · AUTOMATED COMMUNITY GUIDE</p>
      <div className="hc-feed-welcome-avatar" aria-hidden="true">HC</div>
      <h1>Welcome to HoopFeed{displayName ? ", " + displayName : ""}!</h1>
      <p className="muted">I’m HoopBot, your automated welcome guide—not a person or a live chat assistant.</p>
      <p>{rolePrompts[role]}</p>
      <div className="actions"><Link href="/feed" className="btn">Explore HoopFeed</Link><Link href="/account" className="btn dark">Personalize your profile</Link></div>
    </section>
    <section className="hc-feed-welcome-cards" aria-label="Getting started on HoopFeed">
      <article className="dashboard-card"><h2>1. Find your community</h2><p>Follow players and teams. Your Following and My World views help surface the conversations that matter to you.</p><Link href="/search">Discover people and teams</Link></article>
      <article className="dashboard-card"><h2>2. Join the conversation</h2><p>Post, comment, reply, use Check, and share basketball news. Content and membership access rules still apply.</p><Link href="/feed">See the feed</Link></article>
      <article className="dashboard-card"><h2>3. Choose a group</h2><p>Team Fan Groups belong to individual clubs. HoopGroups are separate topic-based basketball communities.</p><div className="actions"><Link href="/team-hub/groups">Team Fan Groups</Link><Link href="/hoopgroups">HoopGroups</Link></div></article>
      <article className="dashboard-card"><h2>4. Keep HoopFeed safe</h2><p>Protect private information, avoid impersonation or scams, and use reporting tools when something is wrong.</p><Link href="/community-guidelines">Community guidelines</Link></article>
    </section>
  </div></main>;
}
