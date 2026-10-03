cat > app/dashboard/page.tsx <<'EOF'
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Profile = {
  display_name: string | null;
};

type Subscription = {
  plan: "pro" | "premium" | null;
  status: string | null;
};

type AdminRole = {
  role: string;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] =
    useState<"admin" | "moderator" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      const {
        data: { user },
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

        supabase
          .from("admin_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle(),
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
        setSubscription(subscriptionResult.data);
      }

      if (adminRoleResult.data) {
        const role = adminRoleResult.data.role
          .trim()
          .toLowerCase();

        if (
          role === "admin" ||
          role === "moderator"
        ) {
          setIsAdmin(true);
          setAdminRole(role);
        }
      }

      setLoading(false);
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-container">
          <p>Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  const displayName =
    profile?.display_name || "Player";

  const planLabel =
    subscription?.plan === "premium"
      ? "HoopCheck Premium"
      : subscription?.plan === "pro"
        ? "HoopCheck Pro"
        : "Free";

  const subscriptionStatus =
    subscription?.status || "inactive";

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="topbar">
          <div>
            <Link
              href="/"
              className="brand"
            >
              HOOPCHECK
            </Link>
          </div>

          <nav className="topnav">
            <Link href="/search">
              Search
            </Link>

            <Link href="/membership">
              Membership
            </Link>

            {isAdmin && (
              <Link
                href="/admin/directory"
                className="btn"
              >
                Admin
              </Link>
            )}
          </nav>
        </header>

        <section className="hero-card">
          <div>
            <p className="eyebrow">
              PLAYER DASHBOARD
            </p>

            <h1>
              Welcome back, {displayName}.
            </h1>

            <p className="muted">
              Research coaches, teams, and
              leagues before your next move.
            </p>
          </div>

          <div className="membership-badge">
            <span>
              Membership
            </span>

            <strong>
              {planLabel}
            </strong>

            <small>
              {subscriptionStatus}
            </small>
          </div>
        </section>

        <section className="grid">
          <Link
            href="/coaches"
            className="dashboard-card"
          >
            <span className="card-kicker">
              COACHES
            </span>

            <h2>
              Research Coaches
            </h2>

            <p>
              Explore coach profiles,
              ratings, and reviews.
            </p>
          </Link>

          <Link
            href="/teams"
            className="dashboard-card"
          >
            <span className="card-kicker">
              TEAMS
            </span>

            <h2>
              Research Teams
            </h2>

            <p>
              Explore professional teams,
              ratings, and reviews.
            </p>
          </Link>

          <Link
            href="/leagues"
            className="dashboard-card"
          >
            <span className="card-kicker">
              LEAGUES
            </span>

            <h2>
              Research Leagues
            </h2>

            <p>
              Explore leagues and player
              experiences.
            </p>
          </Link>

          <Link
            href="/membership"
            className="dashboard-card"
          >
            <span className="card-kicker">
              MEMBERSHIP
            </span>

            <h2>
              Manage Membership
            </h2>

            <p>
              View your plan and manage
              your subscription.
            </p>
          </Link>
        </section>

        {isAdmin && (
          <section className="admin-section">
            <div className="admin-header">
              <div>
                <p className="eyebrow">
                  {adminRole === "moderator"
                    ? "MODERATOR"
                    : "ADMINISTRATOR"}
                </p>

                <h2>
                  Admin Control Center
                </h2>

                <p className="muted">
                  Manage directory data,
                  reviews, and moderation.
                </p>
              </div>
            </div>

            <div className="grid">
              <Link
                href="/admin/directory"
                className="dashboard-card"
              >
                <span className="card-kicker">
                  ADMIN
                </span>

                <h2>
                  Open Admin Panel
                </h2>

                <p>
                  Manage HoopCheck directory
                  operations.
                </p>
              </Link>

              <Link
                href="/admin/directory/coaches"
                className="dashboard-card"
              >
                <span className="card-kicker">
                  DIRECTORY
                </span>

                <h2>
                  Manage Coaches
                </h2>

                <p>
                  Manage coach profiles,
                  teams, leagues, and sources.
                </p>
              </Link>

              <Link
                href="/admin/reviews"
                className="dashboard-card"
              >
                <span className="card-kicker">
                  MODERATION
                </span>

                <h2>
                  Manage Reviews
                </h2>

                <p>
                  Review, approve, reject,
                  and moderate submissions.
                </p>
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
EOF
