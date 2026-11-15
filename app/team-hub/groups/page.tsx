"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthState } from "../../../components/AuthProvider";
import HoopLoading from "../../../components/HoopLoading";
import { useLanguage } from "../../../components/LanguageProvider";
import { supabase } from "../../../lib/supabase";

type Group = { team_id: string; group_name: string };
type Membership = { team_id: string; group_name: string };
type TeamContext = { id: string; country: string | null; basketball_type: string | null; league_name: string | null };
const PAGE_SIZE = 24;

export default function FanGroupsPage() {
  const { userId } = useAuthState();
  const { language } = useLanguage();
  const spanish = language === "es";
  const [query, setQuery] = useState("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [totalGroups, setTotalGroups] = useState<number | null>(null);
  const [directoryTeams, setDirectoryTeams] = useState<TeamContext[]>([]);
  const [filterIndexFailed, setFilterIndexFailed] = useState(false);
  const [country, setCountry] = useState("");
  const [league, setLeague] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{
    userId: string; query: string; country: string; league: string; page: number; groups: Group[]; teams: Record<string, TeamContext>; hasNext: boolean; failed: boolean;
  } | null>(null);
  const current = result?.userId === userId && result.query === query && result.country === country && result.league === league && result.page === page ? result : null;
  const visibleGroups = current?.groups ?? [];
  const availableCountries = Array.from(new Set([...directoryTeams.map(t => t.country).filter((value): value is string => Boolean(value)), ...(country ? [country] : [])])).sort();
  const availableLeagues = Array.from(new Set([...directoryTeams.filter(t => !country || t.country === country).map(t => t.league_name).filter((value): value is string => Boolean(value)), ...(league ? [league] : [])])).sort();


  useEffect(() => {
    if (!userId) { setDirectoryTeams([]); return; }
    let active = true;
    void (async () => {
      try {
      const all: TeamContext[] = [];
      const batchSize = 500;
      for (let offset = 0; offset < 100000; offset += batchSize) {
        const { data, error } = await supabase.from("team_fan_groups")
          .select("teams!inner(id,country,basketball_type,league_name)")
          .order("team_id").range(offset, offset + batchSize - 1);
        if (!active) return;
        if (error) { setFilterIndexFailed(true); return; }
        for (const row of data ?? []) {
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          if (team?.id) all.push(team as TeamContext);
        }
        if ((data?.length ?? 0) < batchSize) {
          setDirectoryTeams(all);
          setFilterIndexFailed(false);
          return;
        }
      }
      if (active) setFilterIndexFailed(true);
      } catch {
        if (active) setFilterIndexFailed(true);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) { setMemberships([]); return; }
    let active = true;
    void (async () => {
      const { data: rows, error } = await supabase.from("team_fan_group_members").select("team_id").eq("user_id", userId);
      if (error || !rows?.length) { if (active) setMemberships([]); return; }
      const ids = rows.map(row => row.team_id);
      const { data: groups } = await supabase.from("team_fan_groups").select("team_id,group_name").in("team_id", ids);
      const names = new Map((groups ?? []).map(group => [group.team_id, group.group_name]));
      if (active) setMemberships(ids.filter(id => names.has(id)).map(id => ({team_id:id,group_name:names.get(id)!})));
    })();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setTotalGroups(null);
    const timer = window.setTimeout(() => {
      const start = page * PAGE_SIZE;
      let request = supabase.from("team_fan_groups").select("team_id,group_name,teams!inner(id,country,basketball_type,league_name)")
        .order("group_name").order("team_id").range(start, start + PAGE_SIZE);
      const term = query.replace(/[%_*\\]/g, " ").trim();
      if (term) request = request.ilike("group_name", `%${term}%`);
      if (country) request = request.eq("teams.country", country);
      if (league) request = request.eq("teams.league_name", league);
      const countRequest = supabase.from("team_fan_groups").select("team_id,teams!inner(id)", { count: "exact", head: true });
      let counted = term ? countRequest.ilike("group_name", `%${term}%`) : countRequest;
      if (country) counted = counted.eq("teams.country", country);
      if (league) counted = counted.eq("teams.league_name", league);
      void Promise.all([Promise.resolve(request), Promise.resolve(counted)]).then(async ([{ data, error }, { count, error: countError }]) => {
        if (active) setTotalGroups(countError ? null : count);
        const groups = (data ?? []).slice(0, PAGE_SIZE).map(({ team_id, group_name }) => ({ team_id, group_name }));
        const teams: Record<string, TeamContext> = {};
        if (!error && groups.length) {
          for (const group of (data ?? [])) {
            const team = Array.isArray(group.teams) ? group.teams[0] : group.teams;
            if (team?.id) teams[team.id] = team as TeamContext;
          }
        }
        if (!error && groups.length) {
          const summaries = await Promise.all(groups.map(async group => {
            const {data} = await supabase.rpc("get_team_fan_group_summary", {p_team_id: group.team_id});
            const row = Array.isArray(data) ? data[0] : null;
            return [group.team_id, row?.member_count] as const;
          }));
          if (active) setMemberCounts(old => ({...old, ...Object.fromEntries(summaries.filter(([,n]) => typeof n === "number"))}));
        }
        if (active) setResult({
          userId, query, country, league, page, groups, teams,
          hasNext: (data?.length ?? 0) > PAGE_SIZE, failed: Boolean(error),
        });
      }).catch(() => {
        if (active) {
          setTotalGroups(null);
          setResult({ userId, query, country, league, page, groups: [], teams: {}, hasNext: false, failed: true });
        }
      });
    }, query ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [userId, query, country, league, page]);

  return <main className="page-shell hc-fan-groups-directory">
    <div className="page-container">
      <header className="hc-groups-heading"><h1>HOOPGROUPS</h1><button className="btn" type="button" disabled title="Community group creation opens after Report and Block verification">+ Create Group</button></header>
      {!userId ? <Link className="btn" href="/login?returnTo=%2Fteam-hub%2Fgroups">
        {spanish ? "Inicia sesión para ver los grupos" : "Sign in to browse groups"}
      </Link> : <>
        <section aria-label="My Groups"><h2>My Groups</h2>{memberships.length ? <div className="hc-groups-compact">{memberships.map(m => <Link key={m.team_id} href={`/team-hub/groups/${m.team_id}`}>{m.group_name.replace(/ Fan Group$/, "")}</Link>)}</div> : <p className="muted">No joined groups yet.</p>}</section>
        <section aria-label="Categories"><h2>Browse categories</h2><div className="hc-groups-categories">{["Club Groups","Players","Fans","Coaches","Agents","Scouts","Teams","Open Community"].map(name => <button key={name} type="button" disabled={name !== "Club Groups"} title={name !== "Club Groups" ? "Community groups are not yet available" : undefined}>{name}</button>)}</div></section>
        <p className="muted">{totalGroups === null ? "Group count unavailable" : `${totalGroups.toLocaleString()} matching official club groups`} · Country and league filters search all groups.</p>
        {filterIndexFailed && <p role="status" className="muted">Could not load all filter choices. Search remains available.</p>}
        <div className="hc-groups-filters"><label>Country <select value={country} onChange={e=>{setCountry(e.target.value);setLeague("");setPage(0);}}><option value="">All countries</option>{availableCountries.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>League <select value={league} onChange={e=>{setLeague(e.target.value);setPage(0);}}><option value="">All leagues</option>{availableLeagues.map(v=><option key={v} value={v}>{v}</option>)}</select></label></div>
        <input type="search" aria-label={spanish ? "Buscar grupos" : "Search HoopGroups"}
          placeholder={spanish ? "Buscar grupos" : "Search HoopGroups"}
          maxLength={120} value={query} onChange={event => {
            setQuery(event.target.value);
            setPage(0);
          }} />
        {!current ? <HoopLoading variant="inline" label={spanish ? "Cargando grupos" : "Loading groups"} />
          : current.failed ? <p role="status">{spanish ? "No se pudieron cargar los grupos." : "Could not load HoopGroups."}</p>
          : visibleGroups.length ? <ul className="result-grid hc-fan-groups-list">
            {visibleGroups.map(group => <li key={group.team_id} className="result-card hc-fan-groups-item">
              <Link href={`/team-hub/groups/${group.team_id}`}>{group.group_name.replace(/ Fan Group$/, "")}</Link><span className="hc-group-official">Official</span><span className="muted">{memberCounts[group.team_id] === undefined ? "Members unavailable" : `${memberCounts[group.team_id]} members`}</span><Link href={`/team-hub/groups/${group.team_id}`} className="btn">{memberships.some(m=>m.team_id===group.team_id) ? "Joined" : "View / Join"}</Link>
              {current.teams[group.team_id] && <p className="muted hc-fan-group-context">
                {[
                  current.teams[group.team_id].country,
                  current.teams[group.team_id].basketball_type === "mens" ? (spanish ? "Masculino" : "Men") :
                    current.teams[group.team_id].basketball_type === "womens" ? (spanish ? "Femenino" : "Women") : null,
                  current.teams[group.team_id].league_name,
                ].filter(Boolean).join(" · ")}
              </p>}
            </li>)}
          </ul> : <p role="status">{spanish ? "No se encontraron grupos." : "No groups match these filters on this results page."}</p>}
        {(page > 0 || current?.hasNext) && <div className="actions">
          <button type="button" className="btn dark" disabled={page === 0} onClick={() => setPage(page - 1)}>
            {spanish ? "Anterior" : "Previous"}
          </button>
          <button type="button" className="btn dark" disabled={!current?.hasNext} onClick={() => setPage(page + 1)}>
            {spanish ? "Siguiente" : "Next"}
          </button>
        </div>}
      </>}
    </div>
  </main>;
}
