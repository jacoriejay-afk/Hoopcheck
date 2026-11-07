"use client";

import Link from "next/link";
import "../hoopcheck-brand-directory.css";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import SearchBar from "../../components/SearchBar";

const categories = [
  { title: "Professional Teams", description: "Follow your team and explore first-hand feedback.", href: "/teams", icon: "T", color: "#ff5500", group: "Teams" },
  { title: "Women's Basketball", description: "Follow women's teams and explore first-hand feedback.", href: "/womens", icon: "W", color: "#db2777", group: "Teams" },
  { title: "Coaches", description: "Research coaches through first-hand reviews.", href: "/coaches", icon: "C", color: "#2563eb", group: "People" },
  { title: "Find Players", description: "Search for players by username and discover public profiles.", href: "/players", icon: "P", color: "#7c3aed", group: "People" },
  { title: "Leagues & Competitions", description: "Browse national and international leagues.", href: "/leagues", icon: "L", color: "#059669", group: "Competitions" },
  { title: "Reviews & Analytics", description: "Read published reviews and team feedback.", href: "/reviews", icon: "★", color: "#d97706", group: "Feedback" },
  { title: "Alerts & Notifications", description: "Keep up with account and basketball updates.", href: "/notifications", icon: "!", color: "#0891b2", group: "Tools" },
];

const groups = ["All", "Teams", "People", "Competitions", "Feedback", "Tools"] as const;

export default function DirectoryPage() {
  const [group, setGroup] = useState<(typeof groups)[number]>("All");
  const [query, setQuery] = useState("");
  const [showPlayers, setShowPlayers] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { if (active) setShowPlayers(true); return; }
      const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", session.user.id).maybeSingle();
      if (active) setShowPlayers(Boolean(profile && profile.account_type !== "fan"));
    })();
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return categories.filter((category) => {
      if (category.href === "/players" && !showPlayers) return false;
      const matchesGroup = group === "All" || category.group === group;
      const matchesQuery = !normalized ||
        category.title.toLowerCase().includes(normalized) ||
        category.description.toLowerCase().includes(normalized);
      return matchesGroup && matchesQuery;
    });
  }, [group, query, showPlayers]);

  return (
    <main className="hc-directory-page">
      <header className="hc-directory-intro">
        <p className="hc-directory-kicker">Your next move starts here</p>
        <h1>Browse categories</h1>
        <p>Explore teams, coaches, leagues, reviews, and basketball communities to make an informed decision.</p>
      </header>

      <SearchBar className="hc-directory-search" value={query} onChange={setQuery} placeholder="Search teams, coaches, leagues, or reviews" ariaLabel="Search directory categories" onSubmit={setQuery} />

      <div className="hc-directory-filters" aria-label="Filter directory categories">
        {groups.map((option) => (
          <button
            type="button"
            key={option}
            className="hc-directory-filter"
            aria-pressed={group === option}
            onClick={() => setGroup(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <section className="hc-directory-list" aria-label="HoopCheck categories">
        {visible.length ? visible.map((category) => (
          <Link className="hc-directory-row" href={category.href} key={category.title}>
            <span className="hc-directory-emblem" style={{ "--emblem-color": category.color } as React.CSSProperties} aria-hidden="true">
              {category.icon}
            </span>
            <span className="hc-directory-copy">
              <strong>{category.title}</strong>
              <small>{category.description}</small>
            </span>
            <span className="hc-directory-arrow" aria-hidden="true">›</span>
          </Link>
        )) : (
          <p className="hc-directory-empty">No categories match your search.</p>
        )}
      </section>
    </main>
  );
}
