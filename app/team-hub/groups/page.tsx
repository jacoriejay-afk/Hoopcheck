"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthState } from "../../../components/AuthProvider";
import HoopLoading from "../../../components/HoopLoading";
import { useLanguage } from "../../../components/LanguageProvider";
import { supabase } from "../../../lib/supabase";

type Side = "all" | "mens" | "womens";
type Group = { team_id: string; group_name: string; team: TeamContext | null };
type TeamContext = { id: string; name: string; country: string | null; basketball_type: string | null; league_name: string | null };
const PAGE_SIZE = 24;

export default function FanGroupsPage() {
  const { userId } = useAuthState();
  const { language } = useLanguage();
  const spanish = language === "es";
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [side, setSide] = useState<Side>("all");
  const [onlyFollowed, setOnlyFollowed] = useState(false);
  const [followedIds, setFollowedIds] = useState<string[] | null>(null);
  const [result, setResult] = useState<{
    key: string; groups: Group[]; hasNext: boolean; failed: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setFollowedIds(null);
    if (!userId) return () => { active = false; };
    void supabase.from("follow_relationships").select("target_id")
      .eq("follower_id", userId).eq("target_type", "team").limit(500)
      .then(({ data, error }) => {
        if (active) setFollowedIds(error ? [] : [...new Set((data || []).map(row => row.target_id))]);
      });
    return () => { active = false; };
  }, [userId]);

  const followedKey = followedIds?.join(",") ?? "loading";
  const key = JSON.stringify([userId, query, page, side, onlyFollowed, followedKey]);
  const current = result?.key === key ? result : null;

  useEffect(() => {
    if (!userId || (onlyFollowed && followedIds === null)) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (onlyFollowed && !followedIds?.length) {
        setResult({ key, groups: [], hasNext: false, failed: false });
        return;
      }
      const start = page * PAGE_SIZE;
      // Join against teams to filter across the entire directory before pagination.
      // Client-side filtering after pagination can conceal women's or followed groups.
      let request = supabase.from("team_fan_groups")
        .select("team_id,group_name,teams!inner(id,name,country,basketball_type,league_name)")
        .order("group_name").order("team_id").range(start, start + PAGE_SIZE);
      const term = query.replace(/[%_*\\]/g, " ").trim();
      if (term) request = request.ilike("group_name", "%" + term + "%");
      if (side !== "all") request = request.eq("teams.basketball_type", side);
      if (onlyFollowed) request = request.in("team_id", followedIds || []);
      void Promise.resolve(request).then(({ data, error }) => {
        if (!active) return;
        const groups: Group[] = ((data || []) as Array<{
          team_id: string; group_name: string; teams: TeamContext | TeamContext[] | null;
        }>).slice(0, PAGE_SIZE).map(row => ({
          team_id: row.team_id,
          group_name: row.group_name,
          team: Array.isArray(row.teams) ? (row.teams[0] || null) : row.teams,
        }));
        setResult({ key, groups, hasNext: (data?.length || 0) > PAGE_SIZE, failed: Boolean(error) });
      }, () => {
        if (active) setResult({ key, groups: [], hasNext: false, failed: true });
      });
    }, query ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [userId, query, page, side, onlyFollowed, followedKey, followedIds, key]);

  const labels = spanish
    ? { title: "Grupos de aficionados", intro: "Comunidades de aficionados oficiales de cada club. HoopGroups es una sección diferente.", all: "Todos", women: "Femenino", men: "Masculino", mine: "Mis equipos", search: "Buscar grupos por club", open: "Abrir grupo", team: "Perfil del equipo", empty: "No hay grupos para estos filtros.", retry: "No se pudieron cargar los grupos.", previous: "Anterior", next: "Siguiente", signIn: "Inicia sesión para ver los grupos" }
    : { title: "Team Fan Groups", intro: "Official fan communities for individual women's and men's clubs. HoopGroups is a separate feature.", all: "All clubs", women: "Women", men: "Men", mine: "My Teams", search: "Search groups by club", open: "Open group", team: "Team profile", empty: "No groups match these filters.", retry: "Could not load groups.", previous: "Previous", next: "Next", signIn: "Sign in to browse groups" };

  return <main className="page-shell hc-fan-groups-directory">
    <div className="page-container">
      <header className="hc-discovery-heading">
        <div><p className="eyebrow">HOOPCHECK COMMUNITY</p><h1>{labels.title}</h1><p className="muted">{labels.intro}</p></div>
        <div className="actions"><Link href="/teams" className="btn dark">{spanish ? "Explorar clubes" : "Explore clubs"}</Link><Link href="/hoopgroups" className="btn">{spanish ? "Comunidades HoopGroups" : "HoopGroups communities"}</Link></div>
      </header>
      {!userId ? <Link className="btn" href="/login?returnTo=%2Fteam-hub%2Fgroups">{labels.signIn}</Link> : <>
        <section className="hc-team-directory-filters" aria-label={spanish ? "Filtros de grupos" : "Group filters"}>
          <div className="hc-team-discovery-links">
            {([{ value: "all", label: labels.all }, { value: "womens", label: labels.women }, { value: "mens", label: labels.men }] as const).map(option =>
              <button key={option.value} type="button" className="hc-discovery-filter"
                aria-pressed={side === option.value}
                onClick={() => { setSide(option.value); setPage(0); }}>{option.label}</button>)}
            <button type="button" className="hc-discovery-filter" aria-pressed={onlyFollowed}
              onClick={() => { setOnlyFollowed(value => !value); setPage(0); }}>{labels.mine}</button>
          </div>
          <input type="search" aria-label={labels.search} placeholder={labels.search} maxLength={120}
            value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
        </section>
        {!current ? <HoopLoading variant="inline" label={spanish ? "Cargando grupos" : "Loading groups"} />
          : current.failed ? <p role="alert">{labels.retry}</p>
          : current.groups.length ? <>
            <p className="muted" role="status">{current.groups.length} {spanish ? "grupos en esta página" : "groups on this page"}</p>
            <ul className="result-grid hc-fan-groups-list">
              {current.groups.map(group => {
                const teamHref = (group.team?.basketball_type === "womens" ? "/womens/" : "/teams/") + group.team_id;
                return <li key={group.team_id} className="result-card hc-fan-groups-item">
                  <strong><Link href={"/team-hub/groups/" + group.team_id}>{group.group_name}</Link></strong>
                  <p className="muted hc-fan-group-context">
                    {[group.team?.country, group.team?.basketball_type === "womens" ? labels.women : labels.men, group.team?.league_name].filter(Boolean).join(" · ")}
                  </p>
                  <div className="actions">
                    <Link href={"/team-hub/groups/" + group.team_id} className="btn">{labels.open}</Link>
                    <Link href={teamHref}>{labels.team}</Link>
                  </div>
                </li>;
              })}
            </ul>
          </> : <p role="status">{labels.empty}</p>}
        {(page > 0 || current?.hasNext) && <nav className="actions" aria-label={spanish ? "Páginas de grupos" : "Group pages"}>
          <button type="button" className="btn dark" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>{labels.previous}</button>
          <span>{page + 1}</span>
          <button type="button" className="btn dark" disabled={!current?.hasNext} onClick={() => setPage(value => value + 1)}>{labels.next}</button>
        </nav>}
      </>}
    </div>
  </main>;
}
