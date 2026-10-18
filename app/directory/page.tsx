"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type DirectoryIcon = "team" | "coach" | "player" | "league" | "review" | "bell";

type DirectoryCategory = { title: string; description: string; href: string; icon: DirectoryIcon; color: string; group: string };

const categories: DirectoryCategory[] = [
  { title: "Professional Teams", description: "Research clubs, contracts, and player experiences before you sign.", href: "/teams", icon: "team", color: "#ff5500", group: "Teams" },
  { title: "Women's Basketball", description: "Discover women's professional teams and competitions worldwide.", href: "/womens", icon: "team", color: "#db2777", group: "Teams" },
  { title: "Coaches", description: "Explore coaching reputations and player feedback.", href: "/coaches", icon: "coach", color: "#2563eb", group: "People" },
  { title: "Find Players", description: "Search for players by username and discover public profiles.", href: "/players", icon: "player", color: "#7c3aed", group: "People" },
  { title: "Leagues & Competitions", description: "Browse national and international leagues.", href: "/leagues", icon: "league", color: "#059669", group: "Competitions" },
  { title: "Reviews & Analytics", description: "Read published experiences and review rating trends.", href: "/reviews", icon: "review", color: "#d97706", group: "Feedback" },
  { title: "Alerts & Notifications", description: "Keep up with account and basketball updates.", href: "/notifications", icon: "bell", color: "#0891b2", group: "Tools" },
];

const groups = ["All", "Teams", "People", "Competitions", "Feedback", "Tools"] as const;

function DirectoryGlyph({ type }: { type: DirectoryIcon }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>
      {type === "team" && <><path d="m12 2.5 8 3.8v6c0 4.2-3.1 7.2-8 9.2-4.9-2-8-5-8-9.2v-6l8-3.8Z" /><path d="M8 9h8v6H8zM8 12h8" /></>}
      {type === "coach" && <><circle cx="12" cy="7.5" r="3.7" /><path d="M4 21c.5-4.5 3.2-6.8 8-6.8s7.5 2.3 8 6.8" /></>}
      {type === "player" && <><circle cx="12" cy="7.5" r="3.7" /><path d="M4 21c.5-4.5 3.2-6.8 8-6.8s7.5 2.3 8 6.8" /><path d="m16.5 4.5 1.2 1.2 2.1-2.1" /></>}
      {type === "league" && <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 4.5 6 4.5 9S15 18 12 21c-3-3-4.5-6-4.5-9S9 6 12 3Z" /></>}
      {type === "review" && <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.4l6.3-.9L12 2.8Z" />}
      {type === "bell" && <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>}
    </svg>
  );
}

export default function DirectoryPage() {
  const [group, setGroup] = useState<(typeof groups)[number]>("All");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return categories.filter((category) => {
      const matchesGroup = group === "All" || category.group === group;
      const matchesQuery = !normalized ||
        category.title.toLowerCase().includes(normalized) ||
        category.description.toLowerCase().includes(normalized);
      return matchesGroup && matchesQuery;
    });
  }, [group, query]);

  return (
    <main className="hc-directory-page">
      <header className="hc-directory-intro">
        <p className="hc-directory-kicker">Your next move starts here</p>
        <h1>Browse categories</h1>
        <p>Find the teams, coaches, leagues, and player information you need to make an informed decision.</p>
      </header>

      <label className="hc-directory-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
        <span className="sr-only">Search directory categories</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories…"
        />
      </label>

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
              <DirectoryGlyph type={category.icon} />
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
