"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
};

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeagues() {
      const { data } = await supabase
        .from("leagues")
        .select("id, name, country, level")
        .order("name");

      setLeagues(data || []);
      setLoading(false);
    }

    loadLeagues();
  }, []);

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">HoopCheck Leagues</div>

        <h1>Research leagues before you commit.</h1>

        <p>
          Explore professional basketball leagues and player
          experiences from around the world.
        </p>
      </section>

      <section className="grid">
        {loading ? (
          <div className="card">
            <h2>Loading leagues...</h2>
          </div>
        ) : leagues.length === 0 ? (
          <div className="card">
            <h2>No leagues yet</h2>

            <p>
              Leagues will appear here once they are added to
              HoopCheck.
            </p>
          </div>
        ) : (
          leagues.map((league) => (
            <div className="card" key={league.id}>
              <h2>{league.name}</h2>

              <p>
                {league.country || "Country not listed"}
              </p>

              {league.level && (
                <p>Level: {league.level}</p>
              )}

              <button className="btn">
                View League
              </button>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
