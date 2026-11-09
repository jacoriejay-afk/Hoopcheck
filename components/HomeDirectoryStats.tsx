"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Stat = { label: string; value: number };
const roundDown = (value: number) =>
  value <= 0 ? null : value < 10 ? value : value < 100 ? Math.floor(value / 5) * 5 : value < 1000 ? Math.floor(value / 10) * 10 : Math.floor(value / 100) * 100;

export default function HomeDirectoryStats() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [progress, setProgress] = useState(1);
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!stats.length) return;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!desktop || reducedMotion) { setProgress(1); return; }
    setProgress(0);
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const next = Math.min(1, (now - start) / 720);
        setProgress(next);
        if (next < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [stats.length]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true })
        .eq("account_type", "player").eq("profile_visibility", "public")
        .neq("moderation_status", "suspended").not("username", "is", null),
      supabase.from("coaches").select("id", { count: "exact", head: true }),
      supabase.from("teams").select("id", { count: "exact", head: true })
        .eq("active", true).eq("basketball_type", "mens"),
      supabase.from("leagues").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("profiles").select("id", { count: "exact", head: true })
        .eq("account_type", "agent").eq("profile_visibility", "public")
        .neq("moderation_status", "suspended").not("username", "is", null),
    ]).then(([players, coaches, teams, leagues, agents]) => {
      if (!active) return;
      const results = [
        { label: "Players", count: players.count },
        { label: "Coaches", count: coaches.count },
        { label: "Teams", count: teams.count },
        { label: "Leagues", count: leagues.count },
        { label: "Agents", count: agents.count },
      ];
      // Never create a card shell for an unavailable or empty directory count.
      // A signed-out visitor may receive null counts because of public query/RLS
      // behavior; in that case the entire stats section is omitted.
      setStats(results.flatMap(item => {
        const value = item.count == null ? null : roundDown(item.count);
        return value == null ? [] : [{ label: item.label, value }];
      }));
    }).catch(() => {
      if (active) setStats([]);
    });
    return () => { active = false; };
  }, []);

  if (!stats.length) return null;
  return (
    <section ref={root} className="hc-home-directory-stats" aria-label="Live directory totals">
      {stats.map(stat => (
        <div className="hc-home-directory-stat" key={stat.label}>
          <strong>{Math.floor(stat.value * progress).toLocaleString()}+</strong>
          <span>{stat.label}</span>
        </div>
      ))}
    </section>
  );
}
