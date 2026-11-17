"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import HoopFeedFromEntity from "../../../../components/HoopFeedFromEntity";
import LeagueProfileHero from "../../../../components/LeagueProfileHero";
import HoopLoading from "../../../../components/HoopLoading";

type League = { name: string; country: string | null; level: string | null };
type Club = { id: string; name: string };

export default function WomensLeaguePage() {
  const { id } = useParams<{ id: string }>();
  const [league, setLeague] = useState<League | null>();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsUnavailable, setClubsUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    setLeague(undefined);
    setClubs([]);
    setClubsUnavailable(false);
    void Promise.all([
      supabase.from("womens_leagues").select("name,country,level").eq("id", id).eq("active", true).maybeSingle(),
      supabase.from("womens_teams").select("id,name").eq("league_id", id).eq("active", true).order("name"),
    ]).then(([leagueResult, clubResult]) => {
      if (!active) return;
      setLeague(leagueResult.data);
      setClubs(clubResult.data ?? []);
      setClubsUnavailable(Boolean(clubResult.error));
    });
    return () => { active = false; };
  }, [id]);

  return (
    <main className="hc-entity-profile-page hc-league-entity-profile">
      <nav className="hc-directory-switcher hc-profile-directory-switcher" aria-label="Browse HoopCheck directories">
        <Link href="/teams">Men’s Teams</Link>
        <Link href="/womens">Women’s Teams</Link>
        <Link href="/leagues">Leagues</Link>
        <Link href="/search">Global Search</Link>
      </nav>
      {league === undefined ? <HoopLoading /> : league ? (
        <>
          <LeagueProfileHero name={league.name} country={league.country} level={league.level} countryFallback="Country not listed">
            <div className="actions"><Link className="btn dark" href="/womens">Back to women’s teams</Link></div>
          </LeagueProfileHero>
          <section className="hero" aria-labelledby="womens-league-clubs">
            <h2 id="womens-league-clubs">Clubs</h2>
            {clubsUnavailable ? <p role="status">Couldn’t load the clubs for this league.</p> : clubs.length ? (
              <ul className="hc-league-club-list">
                {clubs.map(club => <li key={club.id}><Link className="card" href={`/womens/${club.id}`}>{club.name}</Link></li>)}
              </ul>
            ) : <p>No active clubs are listed for this league.</p>}
          </section>
          <HoopFeedFromEntity id={id} column="womens_league_id" />
        </>
      ) : <h1>League unavailable</h1>}
    </main>
  );
}
