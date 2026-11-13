"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type GroupTeam = { id: string; name: string; country: string | null };

export default function FanGroupsDirectory() {
  const [teams, setTeams] = useState<GroupTeam[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const result = await supabase.from("teams").select("id,name,country").eq("active", true).eq("basketball_type", "mens").order("name").limit(200);
      if (!active) return;
      if (result.error) setError("Fan groups could not be loaded. Please try again.");
      else setTeams((result.data || []) as GroupTeam[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);
  const filtered = teams.filter(team => (team.name + " " + (team.country || "")).toLowerCase().includes(search.toLowerCase()));
  return <main className="page-container" style={{maxWidth:960,margin:"0 auto",padding:"24px 16px"}}>
    <h1>Fan Groups</h1>
    <p>Find your team and join its basketball community.</p>
    <label htmlFor="fan-groups-search">Find a team</label>
    <input id="fan-groups-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search teams or countries" style={{display:"block",width:"100%",padding:12,margin:"12px 0 20px",borderRadius:12}} />
    {loading && <p role="status">Loading fan groups…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && filtered.length === 0 && <p>No matching teams in the current directory results.</p>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
      {filtered.map(team => <Link key={team.id} href={`/team-hub/groups/${team.id}`} style={{padding:16,border:"1px solid var(--border)",borderRadius:16}}>
        <strong>{team.name}</strong><div>{team.country || "Country not listed"}</div><span>Open fan group</span>
      </Link>)}
    </div>
    <p style={{marginTop:20}}>Showing up to 200 active men’s teams. <Link href="/teams">Browse all teams</Link> or <Link href="/womens">women’s teams</Link>.</p>
  </main>;
}
