"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { countryFlag } from "../../../../lib/countryFlag";
import { supabase } from "../../../../lib/supabase";
import HoopFeedFromEntity from "../../../../components/HoopFeedFromEntity";
import HoopLoading from "../../../../components/HoopLoading";
import TeamLogo from "../../../../components/TeamLogo";
import "../../../hoopcheck-brand-team.css";

type League = { name: string; country: string | null; level: string | null };
type Club = { id: string; name: string; city: string | null; country: string | null };

export default function WomensLeaguePage() {
  const { id } = useParams<{ id: string }>();
  const [league, setLeague] = useState<League | null>();
  const [clubs, setClubs] = useState<Club[] | null>(null);
  useEffect(() => {
    let active = true;
    setLeague(undefined);
    setClubs(null);
    const controller = new AbortController();
    async function loadClubs() {
      const byId = new Map<string, Club>();
      for (let offset = 0; offset < 10000; offset += 100) {
        const result = await supabase.from("womens_teams").select("id,name,city,country")
          .eq("league_id", id).eq("active", true).order("id").range(offset, offset + 99).abortSignal(controller.signal);
        if (result.error || !result.data || controller.signal.aborted) throw Error("Women's league clubs unavailable");
        for (const row of result.data) {
          if (byId.has(row.id)) throw Error("Women's league membership changed during paging");
          byId.set(row.id, row);
        }
        if (result.data.length < 100) return [...byId.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
      }
      throw Error("Women's league club paging limit reached");
    }
    void (async()=>{
      const leagueResult=await supabase.from("womens_leagues").select("name,country,level").eq("id", id).eq("active", true).abortSignal(controller.signal).maybeSingle();
      if(!active)return;
      setLeague(leagueResult.error?null:leagueResult.data);
      if(leagueResult.error||!leagueResult.data)return;
      try{
        const rows=await loadClubs();
        if(active)setClubs(rows);
      }catch{if(active)setClubs(null);}
    })().catch(()=>{if(active){setLeague(null);setClubs(null);}});
    return () => { active = false; controller.abort(); };
  }, [id]);

  return <main className="hc-entity-profile-page hc-league-entity-profile">
    <nav className="hc-directory-switcher hc-profile-directory-switcher" aria-label="Browse HoopCheck directories">
      <Link href="/teams">Men’s Teams</Link>
      <Link href="/womens">Women’s Teams</Link>
      <Link href="/coaches">Coaches</Link>
      <Link href="/leagues">Leagues</Link>
      <Link href="/search">Global Search</Link>
    </nav>
    {league === undefined ? <HoopLoading /> : league ? <>
      <section className="hero hc-team-look-hero hc-league-look-hero hc-league-look-hero--womens">
        <p className="eyebrow">Women’s League Research</p>
        <div className="hc-league-hero-id">
          <span className="hc-dir-crest hc-dir-crest--league"><TeamLogo name={league.name} size={72} /></span>
        </div>
        <h1>{league.name}</h1>
        <p className="hc-team-hero-location">{countryFlag(league.country)} {league.country || "Country not listed"}</p>
        {league.level && <p className="hc-team-hero-kicker">{league.level}</p>}
        <div className="actions"><Link href="/womens" className="btn dark">Browse women’s teams</Link></div>
      </section>
      <section className="hero" aria-labelledby="womens-league-clubs">
        <p className="eyebrow">Teams in this league</p>
        <h2 id="womens-league-clubs">Professional organizations</h2>
        {clubs === null ? <p role="status">Teams could not load. Refresh the page to try again.</p> :
          clubs.length === 0 ? <p>No active teams are linked to this league yet.</p> :
          <div className="grid">
            {clubs.map(club => <Link className="card" key={club.id} href={`/womens/${club.id}`}>
              <h3>{club.name}</h3>
              <p>{[club.city, club.country].filter(Boolean).join(", ") || "Location not listed"}</p>
            </Link>)}
          </div>}
      </section>
      <HoopFeedFromEntity id={id} column="womens_league_id" />
    </> : <section className="hero"><h1>League unavailable</h1></section>}
  </main>;
}
