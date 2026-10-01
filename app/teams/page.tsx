"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Team = {
  id: string;
  name: string;
  country: string | null;
  league_name: string | null;
  city: string | null;
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeams() {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, country, league_name, city")
        .order("name");

      if (error) {
        console.error("Error loading teams:", error);
        setTeams([]);
      } else {
        setTeams(data || []);
      }

      setLoading(false);
    }

    loadTeams();
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
        <div className="eyebrow">HoopCheck Teams</div>

        <h1>Research the organization before you sign.</h1>

        <p>
          Explore professional basketball teams and player experiences
          from around the world.
        </p>
      </section>

      <section className="grid">
        {loading ? (
          <div className="card">
            <h2>Loading teams...</h2>
          </div>
        ) : teams.length === 0 ? (
          <div className="card">
            <h2>No teams yet</h2>

            <p>
              Teams will appear here once they are added to HoopCheck.
            </p>
          </div>
        ) : (
          teams.map((team) => (
            <div className="card" key={team.id}>
              <h2>{team.name}</h2>

              <p>
                {team.city && team.country
                  ? `${team.city}, ${team.country}`
                  : team.country ||
                    team.city ||
                    "Location not listed"}
              </p>

              {team.league_name && (
                <p>League: {team.league_name}</p>
              )}

              <Link
                href={`/teams/${team.id}`}
                className="btn"
              >
                View Team
              </Link>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
