"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

export default function CoachProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCoach() {
      const { data } = await supabase
        .from("coaches")
        .select("id, name, country, city")
        .eq("id", id)
        .single();

      setCoach(data);
      setLoading(false);
    }

    if (id) {
      loadCoach();
    }
  }, [id]);

  if (loading) {
    return (
      <main>
        <section className="hero">
          <h1>Loading coach...</h1>
        </section>
      </main>
    );
  }

  if (!coach) {
    return (
      <main>
        <section className="hero">
          <h1>Coach not found</h1>

          <p>
            We couldn't find this coach in HoopCheck.
          </p>

          <Link href="/coaches" className="btn">
            Back to Coaches
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <Link href="/coaches">Coaches</Link>

          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">Coach Profile</div>

        <h1>{coach.name}</h1>

        <p>
          {coach.city && coach.country
            ? `${coach.city}, ${coach.country}`
            : coach.country ||
              coach.city ||
              "Location not listed"}
        </p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Overall Rating</h2>
          <p>⭐ No ratings yet</p>
        </div>

        <div className="card">
          <h2>Communication</h2>
          <p>Not rated yet</p>
        </div>

        <div className="card">
          <h2>Professionalism</h2>
          <p>Not rated yet</p>
        </div>

        <div className="card">
          <h2>Player Development</h2>
          <p>Not rated yet</p>
        </div>

        <div className="card">
          <h2>Payment</h2>
          <p>Not rated yet</p>
        </div>
      </section>

      <section className="hero">
        <div className="card">
          <h2>Player Reviews</h2>

          <p>
            No reviews have been submitted for this coach yet.
          </p>

          <button className="btn">
            Write a Review
          </button>
        </div>
      </section>
    </main>
  );
}
