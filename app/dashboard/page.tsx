"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import NotificationBell from "../../components/NotificationBell";
import { useLanguage } from "../../components/LanguageProvider";

type Profile = { display_name: string | null; player_verified: boolean; moderation_status?: string; moderation_note?: string | null };
type Subscription = {
  plan: "pro" | "premium" | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};
type Review = {
  id: string;
  status: string;
  title: string | null;
  body: string;
  overall_rating: number;
  created_at: string;
  coach_id: string | null;
  team_id: string | null;
  league_id: string | null;
};
type Target = { id: string; name: string };

export default function DashboardPage() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<"admin" | "moderator" | null>(null);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      setEmail(user.email ?? "");
      setUserId(user.id);

      const [profileResult, subscriptionResult, reviewsResult, adminRoleResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("display_name,player_verified,moderation_status,moderation_note")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("subscriptions")
            .select("plan,status,current_period_end,cancel_at_period_end")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("reviews")
            .select("id,status,title,body,overall_rating,created_at,coach_id,team_id,league_id")
            .eq("author_id", user.id)
            .order("created_at", { ascending: false }),
          supabase.rpc("get_current_user_admin_role"),
        ]);

      if (!mounted) return;

      if (!profileResult.error) setProfile(profileResult.data);
      if (!subscriptionResult.error) setSubscription(subscriptionResult.data);

      const rows = reviewsResult.error ? [] : (reviewsResult.data ?? []);
      setReviews(rows);

      const coachIds = rows.flatMap((r) => r.coach_id ? [r.coach_id] : []);
      const teamIds = rows.flatMap((r) => r.team_id ? [r.team_id] : []);
      const leagueIds = rows.flatMap((r) => r.league_id ? [r.league_id] : []);

      const [coaches, teams, leagues] = await Promise.all([
        coachIds.length
          ? supabase.from("coaches").select("id,name").in("id", coachIds)
          : Promise.resolve({ data: [] as Target[] }),
        teamIds.length
          ? supabase.from("teams").select("id,name").in("id", teamIds)
          : Promise.resolve({ data: [] as Target[] }),
        leagueIds.length
          ? supabase.from("leagues").select("id,name").in("id", leagueIds)
          : Promise.resolve({ data: [] as Target[] }),
      ]);

      if (!mounted) return;

      const map: Record<string, Target> = {};
      for (const target of [
        ...(coaches.data ?? []),
        ...(teams.data ?? []),
        ...(leagues.data ?? []),
      ]) {
        map[target.id] = target;
      }
      setTargets(map);

      if (
        !adminRoleResult.error &&
        (adminRoleResult.data === "admin" || adminRoleResult.data === "moderator")
      ) {
        setIsAdmin(true);
        setAdminRole(adminRoleResult.data);
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
          <HoopLoading label="Loading your player dashboard..." />
        </div>
      </main>
    );
  }

  const planLabel =
    subscription?.plan === "premium"
      ? "HoopCheck Premium"
      : subscription?.plan === "pro"
        ? "HoopCheck Pro"
        : "Free";

  const activeMembership =
    subscription?.status === "active" || subscription?.status === "trialing";

  const statusLabel = subscription?.status || "inactive";

  const reviewCounts = reviews.reduce<Record<string, number>>((counts, review) => {
    counts[review.status] = (counts[review.status] || 0) + 1;
    return counts;
  }, {});

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return;
    window.location.replace("/login");
  }

  function reviewTarget(review: Review) {
    const id = review.coach_id ?? review.team_id ?? review.league_id ?? "";
    const type = review.coach_id ? "Coach" : review.team_id ? "Team" : "League";
    const href = review.coach_id
      ? `/coaches/${id}`
      : review.team_id
        ? `/teams/${id}`
        : `/leagues/${id}`;
    return { id, type, href, name: targets[id]?.name ?? "Directory entry" };
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="topbar">
          <Link href="/dashboard" className="brand">HOOPCHECK</Link>
          <nav className="topnav"><button type="button" onClick={() => window.history.back()} style={{background:"transparent",border:"1px solid #333",color:"inherit",borderRadius:7,padding:"7px 10px",cursor:"pointer"}}>← Back</button>
            <Link href="/search">{t("search")}</Link>
            <Link href="/membership">{t("membership")}</Link>
            <Link href="/account">{t("account")}</Link>
            <Link href="/settings">{t("settings")}</Link>
            <NotificationBell />
            <button type="button" onClick={signOut} style={{background:"transparent",border:0,color:"inherit",cursor:"pointer",font:"inherit"}}>{t("signOut")}</button>
            {isAdmin && (
              <Link href="/admin/directory" className="btn">Admin</Link>
            )}
          </nav>
        </header>

        {(profile?.moderation_status === "warned" || profile?.moderation_status === "flagged") && <section className="dashboard-card" style={{marginBottom:16,border:"1px solid var(--orange)"}}><strong>{profile.moderation_status === "warned" ? "Account warning" : "Profile flagged for review"}</strong><p className="muted">{profile.moderation_note || "Please review the Community Guidelines and contact Support if you need clarification."}</p><Link href="/support" className="btn dark">Contact Support</Link></section>}\n\n        <section className="player-dashboard-card">
          <div className="player-dashboard-main">
            <div>
              <p className="eyebrow">{t("playerDashboard")}</p>
              <h1>{profile?.display_name || "Player"}</h1>
              <p className="muted">Your HoopCheck research hub.</p>
            </div>
            <Link href="/account" className="btn dark">{t("editProfile")}</Link>
          </div>
          <div className="player-dashboard-stats">
            <div><span>MEMBERSHIP</span><strong>{planLabel.replace("HoopCheck ","")}</strong><small>{statusLabel}</small></div>
            <div><span>REVIEWS</span><strong>{reviews.length}</strong><small>{reviewCounts.approved || 0} published</small></div>
            <div><span>PLAYER STATUS</span><strong>{profile?.player_verified ? "VERIFIED" : "UNVERIFIED"}</strong><small>{profile?.player_verified ? "Professional profile" : "Verification available"}</small></div>
          </div>
        </section>

        <section className="grid" style={{ marginTop: 24 }}>
          <div className="dashboard-card">
            <span className="card-kicker">MEMBERSHIP</span>
            <h2>{planLabel}</h2>
            <p className="muted">
              {activeMembership
                ? "Your full HoopCheck research access is active."
                : "Unlock full ratings and player reviews with a membership."}
            </p>
            {subscription?.current_period_end && (
              <p className="muted">
                Current period ends:{" "}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            )}
            {subscription?.cancel_at_period_end && (
              <p className="muted">Cancellation is scheduled at the end of this period.</p>
            )}
            <Link href="/membership" className="btn">
              {activeMembership ? "Manage Membership" : "View Membership"}
            </Link>
          </div>

          <div className="dashboard-card">
            <span className="card-kicker">PLAYER PROFILE</span>
            <h2>
              {profile?.player_verified ? "✓ Verified Player" : "Build your player profile"}
            </h2>
            <p className="muted">
              {profile?.player_verified
                ? "Your professional-player badge is active."
                : "Add your basketball background and request verification."}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/account" className="btn dark">Open Account</Link>
              {userId && <Link href={`/players/${userId}`} className="btn dark">View Public Profile</Link>}
            </div>
          </div>

          <Link href="/coaches" className="dashboard-card">
            <span className="card-kicker">COACHES</span>
            <h2>Research Coaches</h2>
            <p>Explore coach ratings and player experiences.</p>
          </Link>

          <Link href="/teams" className="dashboard-card">
            <span className="card-kicker">TEAMS</span>
            <h2>Research Teams</h2>
            <p>Research professional teams before your next move.</p>
          </Link>

          <Link href="/leagues" className="dashboard-card">
            <span className="card-kicker">LEAGUES</span>
            <h2>Research Leagues</h2>
            <p>Compare league experiences from players who have been there.</p>
          </Link>

          <Link href="/search" className="dashboard-card">
            <span className="card-kicker">DISCOVER</span>
            <h2>Search HoopCheck</h2>
            <p>Find a coach, team, or league by name.</p>
          </Link>
        </section>

        <section style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 }}>
            <div>
              <p className="eyebrow">YOUR ACTIVITY</p>
              <h2>Review History</h2>
            </div>
            <Link href="/search" className="btn">Write a Review</Link>
          </div>

          <div className="grid">
            <div className="dashboard-card">
              <span className="card-kicker">TOTAL</span>
              <h2>{reviews.length}</h2>
              <p className="muted">Reviews submitted</p>
            </div>
            <div className="dashboard-card">
              <span className="card-kicker">PUBLISHED</span>
              <h2>{reviewCounts.approved || 0}</h2>
              <p className="muted">Approved reviews</p>
            </div>
            <div className="dashboard-card">
              <span className="card-kicker">PENDING</span>
              <h2>{reviewCounts.pending || 0}</h2>
              <p className="muted">Awaiting moderation</p>
            </div>
            <div className="dashboard-card">
              <span className="card-kicker">OTHER</span>
              <h2>{(reviewCounts.rejected || 0) + (reviewCounts.flagged || 0) + (reviewCounts.removed || 0)}</h2>
              <p className="muted">Rejected, flagged, or removed</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {!reviews.length ? (
              <div className="dashboard-card">
                <h2>No reviews yet.</h2>
                <p>
                  Your first-hand experience can help another overseas player make a smarter decision.
                </p>
                <Link href="/search" className="btn dark">Find a Coach, Team, or League</Link>
              </div>
            ) : (
              reviews.slice(0, 5).map((review) => {
                const target = reviewTarget(review);
                return (
                  <article key={review.id} className="dashboard-card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <span className="card-kicker">{target.type.toUpperCase()}</span>
                        <h2>{target.name}</h2>
                      </div>
                      <strong>{review.status.toUpperCase()}</strong>
                    </div>
                    {review.title && <h3>{review.title}</h3>}
                    <p>{review.body}</p>
                    <p className="muted">
                      Overall: {review.overall_rating}/5 ·{" "}
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                    <Link href={target.href} className="btn dark">View Profile</Link>
                  </article>
                );
              })
            )}
          </div>

          {reviews.length > 5 && (
            <div style={{ marginTop: 16 }}>
              <Link href="/account" className="btn">View All Reviews in Account</Link>
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="admin-section" style={{ marginTop: 32 }}>
            <div className="admin-header">
              <div>
                <p className="eyebrow">
                  {adminRole === "moderator" ? "MODERATOR" : "ADMINISTRATOR"}
                </p>
                <h2>Admin Control Center</h2>
                <p className="muted">
                  Manage directory data, rights, reviews, and moderation.
                </p>
              </div>
            </div>
            <div className="grid">
              <Link href="/admin/directory" className="dashboard-card">
                <span className="card-kicker">ADMIN</span>
                <h2>Open Admin Panel</h2>
                <p>Manage HoopCheck directory operations.</p>
              </Link>
              <Link href="/admin/reviews" className="dashboard-card">
                <span className="card-kicker">MODERATION</span>
                <h2>Manage Reviews</h2>
                <p>Review, approve, reject, and moderate submissions.</p>
              </Link>
              <Link href="/admin/rights" className="dashboard-card">
                <span className="card-kicker">LEGAL</span>
                <h2>Rights & Coverage</h2>
                <p>Track data rights and production approval by market.</p>
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
