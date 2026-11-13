"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthState } from "../../../components/AuthProvider";
import HoopLoading from "../../../components/HoopLoading";
import { useLanguage } from "../../../components/LanguageProvider";
import { supabase } from "../../../lib/supabase";

type Group = { team_id: string; group_name: string };
const PAGE_SIZE = 24;

export default function FanGroupsPage() {
  const { userId } = useAuthState();
  const { language } = useLanguage();
  const spanish = language === "es";
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{
    userId: string; query: string; page: number; groups: Group[]; hasNext: boolean; failed: boolean;
  } | null>(null);
  const current = result?.userId === userId && result.query === query && result.page === page ? result : null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const start = page * PAGE_SIZE;
      let request = supabase.from("team_fan_groups").select("team_id,group_name")
        .order("group_name").order("team_id").range(start, start + PAGE_SIZE);
      const term = query.replace(/[%_*\\]/g, " ").trim();
      if (term) request = request.ilike("group_name", `%${term}%`);
      void Promise.resolve(request).then(({ data, error }) => {
        if (active) setResult({
          userId, query, page, groups: (data ?? []).slice(0, PAGE_SIZE),
          hasNext: (data?.length ?? 0) > PAGE_SIZE, failed: Boolean(error),
        });
      }, () => {
        if (active) setResult({ userId, query, page, groups: [], hasNext: false, failed: true });
      });
    }, query ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [userId, query, page]);

  return <main className="page-shell hc-fan-groups-directory">
    <div className="page-container">
      <h1>{spanish ? "Grupos de aficionados" : "Fan Groups"}</h1>
      {!userId ? <Link className="btn" href="/login?returnTo=%2Fteam-hub%2Fgroups">
        {spanish ? "Inicia sesión para ver los grupos" : "Sign in to browse groups"}
      </Link> : <>
        <input type="search" aria-label={spanish ? "Buscar grupos" : "Search fan groups"}
          placeholder={spanish ? "Buscar grupos" : "Search fan groups"}
          maxLength={120} value={query} onChange={event => {
            setQuery(event.target.value);
            setPage(0);
          }} />
        {!current ? <HoopLoading variant="inline" label={spanish ? "Cargando grupos" : "Loading groups"} />
          : current.failed ? <p role="status">{spanish ? "No se pudieron cargar los grupos." : "Could not load fan groups."}</p>
          : current.groups.length ? <ul className="result-grid hc-fan-groups-list">
            {current.groups.map(group => <li key={group.team_id} className="result-card hc-fan-groups-item">
              <Link href={`/team-hub/groups/${group.team_id}`}>{group.group_name}</Link>
            </li>)}
          </ul> : <p role="status">{spanish ? "No se encontraron grupos." : "No fan groups found."}</p>}
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
