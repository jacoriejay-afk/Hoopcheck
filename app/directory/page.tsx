"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import SearchBar from "../../components/SearchBar";

const categories = [
  { title: "Professional Teams", description: "Follow your team and see what the players say.", href: "/teams", icon: "T", color: "#ff5500", group: "Teams" },
  { title: "Women's Basketball", description: "Follow women's teams and see what the players say.", href: "/womens", icon: "W", color: "#db2777", group: "Teams" },
  { title: "Coaches", description: "See what players say about coaches.", href: "/coaches", icon: "C", color: "#2563eb", group: "People" },
  { title: "Find Players", description: "Search for players by username and discover public profiles.", href: "/players", icon: "P", color: "#7c3aed", group: "People" },
  { title: "Leagues & Competitions", description: "Browse national and international leagues.", href: "/leagues", icon: "L", color: "#059669", group: "Competitions" },
  { title: "Reviews & Analytics", description: "Read published player experiences and team feedback.", href: "/reviews", icon: "★", color: "#d97706", group: "Feedback" },
  { title: "Alerts & Notifications", description: "Keep up with account and basketball updates.", href: "/notifications", icon: "!", color: "#0891b2", group: "Tools" },
];

const groups = ["All", "Teams", "People", "Competitions", "Feedback", "Tools"] as const;

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

      <SearchBar className="hc-directory-search" value={query} onChange={setQuery} placeholder="Search players, coaches, teams, or leagues" ariaLabel="Search directory categories" onSubmit={setQuery} />

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
