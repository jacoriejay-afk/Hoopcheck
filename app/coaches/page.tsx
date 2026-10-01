"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

export default function CoachesPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCoaches() {
      const { data, error } = await supabase
        .from("coaches")
        .select("id, name, country, city")
        .order("name");

      if (error) {
        console.error("Error loading coaches:", error);
        setCoaches([]);
      } else {
        setCoaches(data || []);
      }

      setLoading(false);
    }

    loadCoaches();
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
        <div className="eyebrow">HoopCheck Coaches</div>

        <h1>Find the coach before you sign.</h1>

        <p>
          Research coaches and see what professional players have
          experienced around the world.
        </p>
      </section>

      <section className="grid">
        {loading ? (
          <div className="card">
            <h2>Loading coaches...</h2>
          </div>
        ) : coaches.length === 0 ? (
          <div className="card">
            <h2>No coaches yet</h2>

            <p>
              Coaches will appear here once they are added to HoopCheck.
            </p>
          </div>
        ) : (
          coaches.map((coach) => (
            <div className="card" key={coach.id}>
              <h2>{coach.name}</h2>

              <p>
                {coach.city && coach.country
                  ? `${coach.city}, ${coach.country}`
                  : coach.country ||
                    coach.city ||
                    "Location not listed"}
              </p>

              <Link
                href={`/coaches/${coach.id}`}
                className="btn"
              >
                View Coach
              </Link>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
