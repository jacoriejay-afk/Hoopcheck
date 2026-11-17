"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import HoopFeedFromEntity from "../../../../components/HoopFeedFromEntity";
import HoopLoading from "../../../../components/HoopLoading";

type League = { name: string; country: string | null; level: string | null };
type Club = { id: string; name: string };

export default function WomensLeaguePage() {
  const { id } = useParams<{ id: string }>();
  const [league, setLeague] = useState<League | null>();
  const [clubs, setClubs] = useState<Club[]>([]);
  useEffect(() => {
    let active = true;
    setLeague(undefined);
    setClubs([]);
    void Promise.all([
      supabase.from("womens_leagues").select("name,country,level").eq("id", id).eq("active", true).maybeSingle(),
      supabase.from("womens_teams").select("id,name").eq("league_id", id).eq("active", true).order("name"),
    ]).then(([leagueResult, clubResult]) => {
      if (!active) return;
      setLeague(leagueResult.data);
      setClubs(clubResult.data ?? []);
    });
    return () => { active = false; };
  }, [id]);

  return <main className="page-shell"><div className="page-container">
    <Link href="/womens">Women’s teams</Link>
    {league === undefined ? <HoopLoading /> : league ? <>
      <h1>{league.name}</h1>
      <p className="muted">{[league.country, league.level].filter(Boolean).join(" · ")}</p>
      {clubs.length > 0 && <section className="hc-entity-feed" aria-label="League clubs"><h2>Clubs</h2>
        <ul>{clubs.map(club => <li key={club.id}><Link href={`/womens/${club.id}`}>{club.name}</Link></li>)}</ul>
      </section>}
      <HoopFeedFromEntity id={id} column="womens_league_id" />
    </> : <h1>League unavailable</h1>}
  </div></main>;
}
