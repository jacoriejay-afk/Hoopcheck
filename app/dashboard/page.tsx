"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Profile = {
  display_name: string | null;
};

type Subscription = {
  plan: "pro" | "premium" | null;
  status: string | null;
};

export default function DashboardPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [adminRole, setAdminRole] =
    useState<"admin" | "moderator" | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const [
        profileResult,
        subscriptionResult,
        adminRoleResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("subscriptions")
          .select("plan, status")
          .eq("user_id", user.id)
          .maybeSingle(),

        supabase.rpc("is_current_user_admin_or_moderator"),
      ]);

      if (!mounted) return;

      if (
        !profileResult.error &&
        profileResult.data
      ) {
        setProfile(profileResult.data);
      }

      if (
        !subscriptionResult.error &&
        subscriptionResult.data
      ) {
        setSubscription(
          subscriptionResult.data
        );
      }

      if (
        !adminRoleResult.error &&
        adminRoleResult.data === true
      ) {
        setIsAdmin(true);
        setAdminRole("admin");
      }

      setLoading(false);
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main>
        <nav className="nav">
          <Link
            href="/"
            className="logo"
          >
            Hoop<span>Check</span>
          </Link>
        </nav>

        <section className="hero">
          <div className="eyebrow">
            HoopCheck
          </div>

          <h1>
            Loading your
            <br />
            dashboard.
          </h1>
        </section>
      </main>
    );
  }

  const isActiveMember =
    subscription?.status === "active" ||
    subscription?.status === "trialing";

  const displayName =
    profile?.display_name || "Player";

  const planLabel =
    subscription?.plan === "premium"
      ? "Premium"
      : subscription?.plan === "pro"
        ? "Pro"
        : "Free";

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
          <Link
            href="/search"
            className="search-nav"
          >
            Search
          </Link>

          <Link href="/coaches">
            Coaches
          </Link>

          <Link href="/teams">
            Teams
          </Link>

          <Link href="/leagues">
            Leagues
          </Link>

          {isAdmin && (
            <Link
              href="/admin/directory"
              className="btn"
            >
              Admin
            </Link>
          )}

          <Link
            href="/membership"
            className="btn"
          >
            Membership
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          Player Dashboard
        </div>

        <h1>
          Welcome,
          <br />
          {displayName}.
        </h1>

        <p>
          Research your next basketball
          opportunity before you put pen
          to paper.
        </p>

        <div className="dashboard-search">
          <div className="search-label">
            GLOBAL RESEARCH
          </div>

          <Link
            href="/search"
            className="search-button"
          >
            <span>
              Search coaches, teams, or leagues...
            </span>

            <strong>Search →</strong>
          </Link>
        </div>

        <div className="actions">
          <Link
            href="/coaches"
            className="btn"
          >
            Research Coaches
          </Link>

          <Link
            href="/teams"
            className="btn dark"
          >
            Research Teams
          </Link>

          <Link
            href="/leagues"
            className="btn dark"
          >
            Research Leagues
          </Link>
        </div>
      </section>

      {isAdmin && (
        <section className="grid">
          <div
            className="card"
            style={{
              border: "2px solid #ff6a00",
            }}
          >
            <div className="eyebrow">
              {adminRole === "moderator"
                ? "Moderator"
                : "Administrator"}
            </div>

            <h2>
              Admin Control Center
            </h2>

            <p>
              Manage HoopCheck directories,
              moderate player reviews, and
              maintain the platform.
            </p>

            <Link
              href="/admin/directory"
              className="btn"
            >
              Open Admin Panel
            </Link>
          </div>

          <div className="card">
            <div className="eyebrow">
              Directory
            </div>

            <h2>
              Coach Directory
            </h2>

            <p>
              Manage coaches, team relationships,
              sources, and active directory status.
            </p>

            <Link
              href="/admin/directory/coaches"
              className="btn"
            >
              Manage Coaches
            </Link>
          </div>

          <div className="card">
            <div className="eyebrow">
              Moderation
            </div>

            <h2>
              Review Queue
            </h2>

            <p>
              Review, approve, reject, and manage
              player-submitted reviews and reports.
            </p>

            <Link
              href="/admin/reviews"
              className="btn"
            >
              Manage Reviews
            </Link>
          </div>
        </section>
      )}

      <section className="grid">
        <div className="card">
          <div className="eyebrow">
            Membership
          </div>

          <h2>
            {planLabel}
          </h2>

          {isActiveMember ? (
            <>
              <p>
                You have full access to
                HoopCheck ratings and
                approved player reviews.
              </p>

              <Link
                href="/membership"
                className="btn"
              >
                Manage Membership
              </Link>
            </>
          ) : (
            <>
              <p>
                You&apos;re currently on the
                free plan. Upgrade to research
                full ratings and reviews.
              </p>

              <Link
                href="/membership"
                className="btn"
              >
                View Plans
              </Link>
            </>
          )}
        </div>

        <div className="card">
          <div className="eyebrow">
            Research
          </div>

          <h2>
            Before You Sign
          </h2>

          <p>
            Check coaches, teams, and leagues
            before making your next overseas
            basketball decision.
          </p>

          <Link
            href="/search"
            className="btn"
          >
            Start Research
          </Link>
        </div>

        <div className="card">
          <div className="eyebrow">
            Player Voice
          </div>

          <h2>
            Share Your Experience
          </h2>

          <p>
            Help other professional players
            understand what to expect from
            basketball organizations worldwide.
          </p>

          <Link
            href="/coaches"
            className="btn"
          >
            Write A Review
          </Link>
        </div>
      </section>

      <section className="hero">
        <div className="eyebrow">
          HoopCheck
        </div>

        <h2>
          Research.
          <br />
          Know.
          <br />
          Move.
        </h2>

        <p>
          Your career is bigger than one
          contract. Make your next move with
          more information.
        </p>

        <div className="actions">
          <Link
            href="/search"
            className="btn"
          >
            Find Anything
          </Link>

          <Link
            href="/teams"
            className="btn dark"
          >
            Find A Team
          </Link>
        </div>

        <button
          type="button"
          className="btn dark"
          onClick={handleLogout}
          style={{
            marginTop: "16px",
          }}
        >
          Log Out
        </button>
      </section>
    </main>
  );
}
