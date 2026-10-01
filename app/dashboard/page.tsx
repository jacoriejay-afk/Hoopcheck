"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function DashboardPage() {
  const router = useRouter();

  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      setUserName(
        profile?.display_name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Player"
      );

      setLoading(false);
    }

    loadUser();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main>
        <section className="hero">
          <h1>Loading HoopCheck...</h1>
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
          <span>Welcome, {userName}</span>

          <button
            className="btn dark"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">Player Dashboard</div>

        <h1>Research before you sign.</h1>

        <p>
          Search coaches, professional teams, and leagues from around
          the world.
        </p>

        <div className="actions">
          <input
            className="input"
            type="text"
            placeholder="Search coaches, teams, or leagues..."
          />
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Coaches</h2>
          <p>
            Explore ratings and player experiences with coaches.
          </p>

          <button className="btn">
            Explore Coaches
          </button>
        </div>

        <div className="card">
          <h2>Teams</h2>
          <p>
            Research professional teams before signing.
          </p>

          <button className="btn">
            Explore Teams
          </button>
        </div>

        <div className="card">
          <h2>Leagues</h2>
          <p>
            Explore player experiences across leagues worldwide.
          </p>

          <button className="btn">
            Explore Leagues
          </button>
        </div>
      </section>

      <section className="hero">
        <div className="card">
          <h2>Want full access?</h2>

          <p>
            Upgrade to HoopCheck Pro or Premium to unlock full
            ratings and player reviews.
          </p>

          <button className="btn">
            View Memberships
          </button>
        </div>
      </section>
    </main>
  );
}
