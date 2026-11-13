"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type GroupTeam = { id: string; name: string; country: string | null };

export default function FanGroupsDirectory() {
  const [teams, setTeams] = useState<GroupTeam[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(0); setDebouncedSearch(search.trim()); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      setTeams([]);
      setHasMore(false);
      let query = supabase.from("teams").select("id,name,country").eq("active", true).eq("basketball_type", "mens");
      if (debouncedSearch) {
        const safe = debouncedSearch.replace(/[%_,()]/g, " ").trim();
        if (safe) query = query.or(`name.ilike.%${safe}%,country.ilike.%${safe}%`);
      }
      const result = await query.order("name").order("id").range(page * 100, page * 100 + 99);
      if (!active) return;
      if (result.error) { setTeams([]); setHasMore(false); setError("Fan groups could not be loaded. Please try again."); }
      else { setTeams((result.data || []) as GroupTeam[]); setHasMore((result.data || []).length === 100); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [page, debouncedSearch]);

  return <main className="page-container" style={{maxWidth:960,margin:"0 auto",padding:"24px 16px"}}>
    <h1>Fan Groups</h1>
    <p>Find your team and join its basketball community.</p>
    <label htmlFor="fan-groups-search">Find a team</label>
    <input id="fan-groups-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search teams or countries" style={{display:"block",width:"100%",padding:12,margin:"12px 0 20px",borderRadius:12}} />
    {loading && <p role="status">Loading fan groups…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && teams.length === 0 && <p>No matching teams found.</p>}
    {!loading && !error && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
      {teams.map(team => <Link key={team.id} href={`/team-hub/groups/${team.id}`} style={{padding:16,border:"1px solid var(--border)",borderRadius:16}}>
        <strong>{team.name}</strong><div>{team.country || "Country not listed"}</div><span>Open fan group</span>
      </Link>)}
    </div>}
    {!error && <div style={{display:"flex",gap:12,marginTop:20,alignItems:"center"}}><button type="button" disabled={page===0 || loading} onClick={()=>setPage(p=>Math.max(0,p-1))}>Previous</button><span>Page {page+1}</span><button type="button" disabled={!hasMore || loading} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
    <p style={{marginTop:20}}>Search all active men’s team fan groups. <Link href="/teams">All teams</Link> · <Link href="/womens">Women’s teams</Link>.</p>
  </main>;
}
