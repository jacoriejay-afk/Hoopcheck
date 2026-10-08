"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import NotificationBell from "../../components/NotificationBell";
import PlayerContactButton from "../../components/PlayerContactButton";
import { useLanguage } from "../../components/LanguageProvider";

type Profile = { display_name: string | null; player_verified: boolean; coach_verified?: boolean; account_type: "player"|"coach"|"scout"|"agent"|"fan"; moderation_status?: string; moderation_note?: string | null };
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

const withTimeout = <T,>(promise: PromiseLike<T>, ms = 8000, fallback?: T) =>
  Promise.race([Promise.resolve(promise), new Promise<T>((resolve) => setTimeout(() => resolve(fallback as T), ms))]);

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
  const [followedTeams, setFollowedTeams] = useState<{id:string;name:string;country:string|null;league_name:string|null}[]>([]);
  const [coachTeams, setCoachTeams] = useState<{id:string;name:string;country:string|null;league_name:string|null}[]>([]);
  const [coachRequests, setCoachRequests] = useState<{id:string;team_id:string;status:string;requested_role:string|null;reviewer_note:string|null}[]>([]);
  const [coachRequestTeam, setCoachRequestTeam] = useState("");
  const [coachRequestRole, setCoachRequestRole] = useState("Head Coach");
  const [coachRequestNote, setCoachRequestNote] = useState("");
  const [coachRequestMessage, setCoachRequestMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      const { data: { session } } = await withTimeout(supabase.auth.getSession(), 5000, { data: { session: null }, error: null });
      const user = session?.user ?? null;
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
            .select("display_name,player_verified,coach_verified,account_type,moderation_status,moderation_note")
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

      if (profileResult.data?.account_type === "coach") {
        const [{data: teamRows}, {data: requestRows}] = await Promise.all([
          supabase.from("teams").select("id,name,country,league_name").eq("active", true).order("name").limit(1000),
          supabase.from("coach_team_requests").select("id,team_id,status,requested_role,reviewer_note").eq("user_id", user.id).order("created_at",{ascending:false}).limit(20)
        ]);
        setCoachTeams((teamRows || []) as any);
        setCoachRequests((requestRows || []) as any);
      }

      if (profileResult.data?.account_type === "fan") {
        const { data: follows } = await supabase.from("follow_relationships").select("target_id").eq("follower_id", user.id).eq("target_type", "team").order("created_at", { ascending: false }).limit(20);
        const ids = (follows || []).map((x:any)=>x.target_id).filter(Boolean);
        if (ids.length) { const { data: teamRows } = await supabase.from("teams").select("id,name,country,league_name").in("id", ids); setFollowedTeams((teamRows || []) as any); }
      }

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
      <main className="page-shell dashboard-page">
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
          <Link href="/" className="brand">HOOPCHECK</Link>
          <nav className="topnav">
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

        {(profile?.moderation_status === "warned" || profile?.moderation_status === "flagged") && <section className="dashboard-card" style={{marginBottom:16,border:"1px solid var(--orange)"}}><strong>{profile.moderation_status === "warned" ? "Account warning" : "Profile flagged for review"}</strong><p className="muted">{profile.moderation_note || "Please review the Community Guidelines and contact Support if you need clarification."}</p><Link href="/support" className="btn dark">Contact Support</Link></section>}        <section className="player-dashboard-card">
          <div className="player-dashboard-main">
            <div>
              <p className="eyebrow">{profile?.account_type === "fan" ? "FAN DASHBOARD" : profile?.account_type ? profile.account_type.toUpperCase()+" DASHBOARD" : t("playerDashboard")}</p>
              <h1>{profile?.display_name || (profile?.account_type === "fan" ? "Fan" : profile?.account_type ? profile.account_type.charAt(0).toUpperCase()+profile.account_type.slice(1) : "Player")}</h1>
              <p className="muted">Your HoopCheck research hub.</p>
            </div>
            <Link href="/profile" className="btn dark">{t("editProfile")}</Link>
          </div>
          <div className="player-dashboard-stats">
            <div><span>MEMBERSHIP</span><strong>{planLabel.replace("HoopCheck ","")}</strong><small>{statusLabel}</small></div>
            <div><span>REVIEWS</span><strong>{reviews.length}</strong><small>{reviewCounts.approved || 0} published</small></div>
            {profile?.account_type === "player" ? <div><span>PLAYER STATUS</span><strong>{profile?.player_verified ? "VERIFIED" : "UNVERIFIED"}</strong><small>{profile?.player_verified ? "Professional profile" : "Verification available"}</small></div> : <div><span>ACCOUNT</span><strong>{profile?.account_type?.toUpperCase()}</strong><small>Research profile</small></div>}
          </div>
        </section>

        {profile?.account_type === "fan" && <section className="grid fan-dashboard-grid" style={{ marginTop: 18 }}>
          <div className="dashboard-card fan-feature-card"><span className="card-kicker">FAN HQ</span><h2>🏀 Your Team Hub</h2><p className="muted">Keep up with the teams you follow, ratings, reviews, and new activity.</p><Link href="/teams" className="btn">Explore Teams</Link></div>
          <div className="dashboard-card fan-feature-card"><span className="card-kicker">PRO FAN</span><h2>🔔 Team Alerts</h2><p className="muted">Follow teams to keep notifications on for ratings, reviews, and team updates.</p><Link href="/teams" className="btn dark">Find Teams to Follow</Link>{subscription?.plan === "premium" && activeMembership && <Link href="/fan-live" className="btn dark">Live Game Chat</Link>}</div>
          {subscription?.plan === "premium" && activeMembership ? <div className="dashboard-card fan-feature-card premium-fan-card"><span className="card-kicker">PREMIUM FAN</span><h2>📊 Fan Base Insights</h2><p className="muted">See follower momentum, community size, review activity, and team sentiment as your fan intelligence hub grows.</p><strong>{followedTeams.length} followed team{followedTeams.length===1?"":"s"}</strong></div> : <div className="dashboard-card fan-feature-card"><span className="card-kicker">PREMIUM FAN</span><h2>Unlock Fan Intelligence</h2><p className="muted">Premium fans get deeper team and fan-base insights, including community activity and team pulse features.</p><Link href="/membership" className="btn">Explore Premium</Link></div>}
          <div className="dashboard-card fan-feature-card"><span className="card-kicker">FAN NETWORK</span><h2>Connect with Fans</h2><p className="muted">Pro and Premium Fans can follow and send connection requests to other fans.</p><Link href="/fans" className="btn">Find Fans</Link></div>{followedTeams.length > 0 && <div className="dashboard-card fan-feature-card"><span className="card-kicker">FOLLOWING</span><h2>My Teams</h2><div className="fan-followed-list">{followedTeams.slice(0,6).map(t=><Link key={t.id} href={"/teams/"+t.id} className="fan-team-row"><span><strong>{t.name}</strong><small>{t.country || "Global"}{t.league_name ? " · "+t.league_name : ""}</small></span><span>›</span></Link>)}</div></div>}
        </section>}

        {["player","fan","scout","agent"].includes(profile?.account_type || "") && (
          <section className="dashboard-card" style={{ marginTop: 24 }}>
            <span className="card-kicker">HOOPFEED</span>
            <h2>{activeMembership && (subscription?.plan === "pro" || subscription?.plan === "premium") ? "HoopFeed" : "Unlock HoopFeed"}</h2>
            <p className="muted">Share and discover current basketball experiences. HoopFeed posts disappear after 24 hours.</p>
            <Link href="/feed" className="btn">{activeMembership && (subscription?.plan === "pro" || subscription?.plan === "premium") ? "Open HoopFeed" : "View HoopFeed"}</Link>
          </section>
        )}

        {(profile?.account_type === "player" || profile?.account_type === "scout" || profile?.account_type === "agent") && (
          <section className="dashboard-card contact-dashboard-card" style={{ marginTop: 24 }}>
            <span className="card-kicker">PLAYER CONNECTIONS</span>
            <h2>{profile.account_type === "player" ? "Recruiting requests" : "Player outreach"}</h2>
            <p className="muted">{profile.account_type === "player" ? "Premium scouts and agents can request contact. You decide who can reach you." : "Premium scouts and agents can request contact with players. A player must accept before messaging opens."}</p>
            {profile.account_type === "player" ? <PlayerContactButton playerId={userId} /> : ["pro","premium"].includes(subscription?.plan || "") && activeMembership ? <Link href="/players" className="btn">Browse Players</Link> : <Link href="/membership" className="btn">Upgrade to Pro or Premium</Link>}
          </section>
        )}

        {profile?.account_type === "coach" && (
          <section className="dashboard-card" style={{ marginTop: 24 }}>
            <span className="card-kicker">COACH TEAM PLACEMENT</span>
            <h2>{profile.coach_verified ? "Request a coaching assignment" : "Verify your coach identity first"}</h2>{profile?.coach_verified && coachRequests.some(r=>r.status==="approved") && <div className="card" style={{margin:"12px 0"}}><strong>Team assignment</strong><p className="muted">{coachTeams.find(t=>t.id===coachRequests.find(r=>r.status==="approved")?.team_id)?.name || "Assigned team"}</p></div>}
            <p className="muted">{profile.coach_verified ? "Pro and Premium coaches can request to be added to a professional team's coaching staff. Once approved, the team appears on your dashboard and public coach profile." : "Complete secure ID + live-selfie verification before requesting a coaching assignment."}</p>
            {!profile.coach_verified ? <Link href="/verification" className="btn">Verify Coach</Link> : !activeMembership || !["pro","premium"].includes(subscription?.plan || "") ? <Link href="/membership" className="btn">Upgrade to Pro or Premium</Link> :
              <div style={{display:"grid",gap:10,marginTop:12}}>
                <select value={coachRequestTeam} onChange={e=>setCoachRequestTeam(e.target.value)}><option value="">Select team</option>{coachTeams.map(t=><option key={t.id} value={t.id}>{t.name}{t.country ? " — "+t.country : ""}{t.league_name ? " · "+t.league_name : ""}</option>)}</select>
                <select value={coachRequestRole} onChange={e=>setCoachRequestRole(e.target.value)}><option>Head Coach</option><option>Assistant Coach</option><option>Associate Head Coach</option><option>Player Development Coach</option><option>Strength & Conditioning Coach</option><option>Other</option></select>
                <textarea value={coachRequestNote} onChange={e=>setCoachRequestNote(e.target.value)} rows={3} maxLength={1000} placeholder="Optional note for the HoopCheck admin team." />
                <button className="btn" type="button" onClick={async()=>{setCoachRequestMessage(""); if(!coachRequestTeam){setCoachRequestMessage("Select a team.");return;} const {error}=await supabase.from("coach_team_requests").insert({user_id:userId,team_id:coachRequestTeam,requested_role:coachRequestRole,note:coachRequestNote.trim()||null}); if(error){setCoachRequestMessage(error.message);return;} setCoachRequestMessage("Request submitted. An admin will review it."); setCoachRequestNote(""); const {data}=await supabase.from("coach_team_requests").select("id,team_id,status,requested_role,reviewer_note").eq("user_id",userId).order("created_at",{ascending:false}).limit(20); setCoachRequests((data||[]) as any);}}>Request Team Placement</button>
                {coachRequestMessage && <p className="muted">{coachRequestMessage}</p>}
                {coachRequests.length > 0 && <div className="card"><strong>Your requests</strong>{coachRequests.map(r=><p key={r.id} className="muted" style={{margin:"8px 0"}}>{coachTeams.find(t=>t.id===r.team_id)?.name || "Team"} · {r.requested_role || "Coach"} · <strong>{r.status}</strong>{r.reviewer_note ? " · "+r.reviewer_note : ""}</p>)}</div>}
              </div>}
          </section>
        )}

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

          {profile?.account_type === "player" && <div className="dashboard-card">
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
          </div>}

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
            {profile?.account_type === "player" && <Link href="/search" className="btn">Write a Review</Link>}
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
