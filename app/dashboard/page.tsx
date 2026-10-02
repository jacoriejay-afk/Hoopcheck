"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Subscription = {
  plan: "pro" | "premium";
  status: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();

      const { data: membership } =
        await supabase
          .from("subscriptions")
          .select("plan, status")
          .eq("user_id", user.id)
          .maybeSingle();

      setUserName(
        profile?.display_name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Player"
      );

      setSubscription(
        membership || null
      );

      setLoading(false);
    }

    loadUser();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const activeSubscription =
    subscription &&
    (
      subscription.status === "active" ||
      subscription.status === "trialing"
    );

  if (loading) {
    return (
      <main>
        <section className="hero">
          <h1>
            Loading HoopCheck...
          </h1>
        </section>
      </main>
    );
  }

  return (
    <main>
      <nav className="nav">
        <Link
          href="/"
          className="logo"
        >
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <span>
            Welcome, {userName}
          </span>

          <button
            className="btn dark"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          Player Dashboard
        </div>

        <h1>
          Research before you sign.
        </h1>

        <p>
          Search coaches, professional
          teams, and leagues from around
          the world.
        </p>

        <div className="actions">
          <input
            className="input"
            type="text"
            placeholder="Search coaches, teams, or leagues..."
            aria-label="Search coaches, teams, or leagues"
            disabled
          />
        </div>

        {activeSubscription ? (
          <div className="card">
            <div className="eyebrow">
              MEMBERSHIP ACTIVE
            </div>

            <h2>
              HoopCheck{" "}
              {subscription?.plan ===
              "premium"
                ? "Premium"
                : "Pro"}
            </h2>

            <p className="muted">
              Your membership gives you
              access to full ratings and
              player reviews.
            </p>

            <Link
              href="/membership"
              className="btn"
            >
              Manage Membership
            </Link>
          </div>
        ) : (
          <div className="card">
            <div className="eyebrow">
              FREE ACCOUNT
            </div>

            <h2>
              Start researching.
            </h2>

            <p className="muted">
              Browse coaches, teams, and
              leagues. Upgrade when you're
              ready to unlock full ratings
              and player reviews.
            </p>

            <Link
              href="/membership"
              className="btn"
            >
              View Memberships
            </Link>
          </div>
        )}
      </section>

      <section className="grid">
        <div className="card">
          <h2>Coaches</h2>

          <p>
            Explore ratings and player
            experiences with coaches.
          </p>

          <Link
            href="/coaches"
            className="btn"
          >
            Explore Coaches
          </Link>
        </div>

        <div className="card">
          <h2>Teams</h2>

          <p>
            Research professional teams
            before signing.
          </p>

          <Link
            href="/teams"
            className="btn"
          >
            Explore Teams
          </Link>
        </div>

        <div className="card">
          <h2>Leagues</h2>

          <p>
            Explore player experiences
            across leagues worldwide.
          </p>

          <Link
            href="/leagues"
            className="btn"
          >
            Explore Leagues
          </Link>
        </div>
      </section>

      <section className="hero">
        <div className="card">
          <h2>
            Help build HoopCheck
          </h2>

          <p className="muted">
            Share your experience with
            coaches, teams, and leagues
            to help other players make
            informed decisions.
          </p>

          <Link
            href="/membership"
            className="btn"
          >
            View Memberships
          </Link>
        </div>
      </section>
    </main>
  );
}
