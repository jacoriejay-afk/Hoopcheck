"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCachedSession, supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import PlayerContactButton from "../../components/PlayerContactButton";
import SearchBar from "../../components/SearchBar";
import { useLanguage } from "../../components/LanguageProvider";
import { HoopIcon, CategoryIconTile, VerifiedBadge } from "../../components/HoopCheckUI";

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
  const router = useRouter();
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
      const { data: { session } } = await withTimeout<any>(
        getCachedSession(),
        7000,
        { data: { session: null }, error: new Error("session-timeout") }
      );
      const user = session?.user ?? null;
      if (!user) {
        if (mounted) router.replace("/login?next=/dashboard");
        return;
      }

      setEmail(user.email ?? "");
      setUserId(user.id);

      const [profileResult, subscriptionResult, reviewsResult, adminRoleResult] =
        await withTimeout<any>(Promise.all([
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
            .order("created_at", { ascending: false }).limit(20),
          supabase.rpc("get_current_user_admin_role"),
        ]), 7000, [
          { data: null, error: new Error("profile-timeout") },
          { data: null, error: new Error("subscription-timeout") },
          { data: [], error: new Error("reviews-timeout") },
          { data: null, error: new Error("admin-role-timeout") },
        ]);

      if (!mounted) return;

      if (!profileResult.error) setProfile(profileResult.data);
      if (!subscriptionResult.error) setSubscription(subscriptionResult.data);

      if (profileResult.data?.account_type === "coach") {
        const [{data: teamRows}, {data: requestRows}] = await Promise.all([
          supabase.from("teams").select("id,name,country,league_name").eq("active", true).order("name").limit(100),
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

      const rows: Review[] = reviewsResult.error ? [] : ((reviewsResult.data ?? []) as Review[]);
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

    loadDashboard().catch((error) => {
      console.error("Unable to load HoopCheck dashboard:", error);
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="page-shell dashboard-page">
        <div className="page-container">
          <HoopLoading label={t("loadingDashboard")} />
        </div>
      </main>
    );
  }

  const planLabel =
    subscription?.plan === "premium"
      ? "HoopCheck " + t("premium")
      : subscription?.plan === "pro"
        ? "HoopCheck " + t("pro")
        : t("free");

  const activeMembership =
    subscription?.status === "active" || subscription?.status === "trialing";

  const statusLabel = t(subscription?.status || "inactive");

  const reviewCounts = reviews.reduce<Record<string, number>>((counts, review) => {
    counts[review.status] = (counts[review.status] || 0) + 1;
    return counts;
  }, {});

  function reviewTarget(review: Review) {
    const id = review.coach_id ?? review.team_id ?? review.league_id ?? "";
    const type = review.coach_id ? t("coach") : review.team_id ? t("team") : t("leagues");
    const href = review.coach_id
      ? `/coaches/${id}`
      : review.team_id
        ? `/teams/${id}`
        : `/leagues/${id}`;
    return { id, type, href, name: targets[id]?.name ?? t("directoryEntry") };
  }

  return (
    <main className="page-shell hc-dashboard-shell" style={{ paddingTop: "max(24px, env(safe-area-inset-top))" }}>
      <div className="page-container">
        {(profile?.moderation_status === "warned" || profile?.moderation_status === "flagged") && <section className="dashboard-card" style={{marginBottom:16,border:"1px solid var(--orange)"}}><strong>{profile.moderation_status === "warned" ? t("accountWarning") : t("profileFlagged")}</strong><p className="muted">{profile.moderation_note || t("supportGuidance")}</p><Link href="/support" className="btn dark">{t("contactSupport")}</Link></section>}        <section className="hc-dashboard-welcome" aria-labelledby="hc-dashboard-welcome-title">
          <p className="eyebrow hc-dashboard-page-label">{t("dashboardLabel")}</p>
          <p className="eyebrow hc-dashboard-kicker">{t("overseasHub")}</p>
          <h1 id="hc-dashboard-welcome-title">KNOW WHO YOU’RE SIGNING WITH<span>.</span></h1>
          <p className="hc-dashboard-hero-description">{t("dashboardHeroDescription")}</p>
        </section>

        <section className="hc-dashboard-profile-block" aria-label={t("yourProfile")}>
          <div className="hc-dashboard-profile-identity">
            <div className="hc-dashboard-avatar" aria-hidden="true">
              {(profile?.display_name?.trim()?.charAt(0) || email.split("@")[0]?.charAt(0) || "H").toUpperCase()}
            </div>
            <div className="hc-dashboard-profile-copy">
              <span className="hc-dashboard-profile-label">{t("signedInAs")}</span>
              <strong className="hc-dashboard-username">{profile?.display_name || (email ? email.split("@")[0] : profile?.account_type === "fan" ? t("fan") : profile?.account_type ? t(profile.account_type) : t("player"))}</strong>
              <span className="hc-dashboard-membership-badge">{planLabel.replace("HoopCheck ","")}{activeMembership ? " · ACTIVE" : " · "+statusLabel.toUpperCase()}</span>
            </div>
          </div>
          <Link href="/profile" className="hc-dashboard-edit-profile">{t("editProfile")} <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10h10.75M10.5 5.25 15.25 10l-4.75 4.75" /></svg></Link>
        </section>

        <section className="hc-dashboard-stat-grid" aria-label={t("accountControls")}>
          <article className="hc-dashboard-stat-card">
            <span className="hc-dashboard-stat-label">{t("membership")}</span>
            <strong className="hc-dashboard-stat-value">{planLabel.replace("HoopCheck ","")}</strong>
            <small className="hc-dashboard-stat-note">{statusLabel}</small>
          </article>
          <article className="hc-dashboard-stat-card">
            <span className="hc-dashboard-stat-label">{t("reviews")}</span>
            <strong className="hc-dashboard-stat-value">{reviews.length}</strong>
            <small className="hc-dashboard-stat-note">{reviewCounts.approved || 0} {t("published")}</small>
          </article>
          <article className="hc-dashboard-stat-card">
            <span className="hc-dashboard-stat-label">{profile?.account_type === "player" ? t("playerStatus") : t("account").toUpperCase()}</span>
            <strong className="hc-dashboard-stat-value">{profile?.account_type === "player" ? (profile.player_verified ? t("verified") : t("unverified")) : profile?.account_type?.toUpperCase()}</strong>
            <small className="hc-dashboard-stat-note">{profile?.account_type === "player" ? (profile.player_verified ? t("professionalProfile") : t("verificationAvailable")) : t("researchProfile")}</small>
          </article>
        </section>

        <section className="hc-mobile-dashboard" aria-label={t("exploreHoopCheck")}>
          <SearchBar className="hc-mobile-search" name="q" placeholder={t("searchPeoplePlaceholder")} ariaLabel={t("searchPeoplePlaceholder")} />

          <section className="hc-mobile-section" aria-labelledby="hc-quick-access-heading">
            <div className="hc-mobile-section-heading">
              <div>
                <p className="hc-mobile-eyebrow">{t("yourShortcuts")}</p>
                <h2 id="hc-quick-access-heading">{t("quickAccess")}</h2>
              </div>
              <span className="hc-mobile-section-count" aria-hidden="true">{profile?.account_type === "fan" ? "03" : "04"}</span>
            </div>
            <div className="hc-mobile-quick-grid">
              {profile?.account_type === "fan" ? (
                <>
                  <Link href="/teams" className="hc-mobile-quick-card">
                    <span className="hc-mobile-icon hc-icon-orange" aria-hidden="true"><CategoryIconTile category="teams" size="sm" /></span>
                    <span className="hc-mobile-card-copy"><strong>TEAM HUB</strong><small>Your teams, all in one place</small></span>
                    <span className="hc-mobile-chevron" aria-hidden="true"><HoopIcon name="chevron-right" size={16} /></span>
                  </Link>
                  <Link href="/fans" className="hc-mobile-quick-card">
                    <span className="hc-mobile-icon hc-icon-purple" aria-hidden="true"><CategoryIconTile category="players" size="sm" /></span>
                    <span className="hc-mobile-card-copy"><strong>FIND FAN</strong><small>Connect with fans like you</small></span>
                    <span className="hc-mobile-chevron" aria-hidden="true"><HoopIcon name="chevron-right" size={16} /></span>
                  </Link>
                  <Link href="/fan-live" className="hc-mobile-quick-card hc-mobile-quick-card-fan-wide" style={profile?.account_type === "fan" ? { gridColumn: "1 / -1" } : undefined}>
                    <span className="hc-mobile-icon hc-icon-green" aria-hidden="true"><CategoryIconTile category="reviews" size="sm" /></span>
                    <span className="hc-mobile-card-copy"><strong>LIVE GAME CHATS</strong><small>Chat during real games</small></span>
                    <span className="hc-mobile-chevron" aria-hidden="true"><HoopIcon name="chevron-right" size={16} /></span>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/teams" className="hc-mobile-quick-card">
                    <span className="hc-mobile-icon hc-icon-orange" aria-hidden="true"><CategoryIconTile category="teams" size="sm" /></span>
                    <span className="hc-mobile-card-copy"><strong>{t("mensTeams")}</strong><small>{t("exploreTeamReviews")}</small></span>
                    <span className="hc-mobile-chevron" aria-hidden="true"><HoopIcon name="chevron-right" size={16} /></span>
                  </Link>
                  <Link href="/womens" className="hc-mobile-quick-card">
                    <span className="hc-mobile-icon hc-icon-pink" aria-hidden="true"><CategoryIconTile category="womens" size="sm" /></span>
                    <span className="hc-mobile-card-copy"><strong>{t("womensTeams")}</strong><small>{t("findNextTeam")}</small></span>
                    <span className="hc-mobile-chevron" aria-hidden="true"><HoopIcon name="chevron-right" size={16} /></span>
                  </Link>
                  <Link href="/coaches" className="hc-mobile-quick-card">
                    <span className="hc-mobile-icon hc-icon-blue" aria-hidden="true"><CategoryIconTile category="coaches" size="sm" /></span>
                    <span className="hc-mobile-card-copy"><strong>{t("coaches")}</strong><small>{t("checkReputations")}</small></span>
                    <span className="hc-mobile-chevron" aria-hidden="true"><HoopIcon name="chevron-right" size={16} /></span>
                  </Link>
                  <Link href="/search" className="hc-mobile-quick-card">
                    <span className="hc-mobile-icon hc-icon-green" aria-hidden="true"><CategoryIconTile category="reviews" size="sm" /></span>
                    <span className="hc-mobile-card-copy"><strong>{t("playerReviews")}</strong><small>{t("realPlayerExperiences")}</small></span>
                    <span className="hc-mobile-chevron" aria-hidden="true"><HoopIcon name="chevron-right" size={16} /></span>
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="hc-mobile-section hc-mobile-browse" aria-labelledby="hc-browse-categories-heading">
            <div className="hc-mobile-section-heading">
              <div>
                <p className="hc-mobile-eyebrow">{t("exploreHoopCheck")}</p>
                <h2 id="hc-browse-categories-heading">{t("browseDirectories")}</h2>
              </div>
              <Link href="/directory" className="hc-mobile-view-all">{t("viewAll")}</Link>
            </div>
            <div className="hc-mobile-category-list">
              <Link href="/teams" className="hc-mobile-category-row">
                <span className="hc-mobile-category-icon hc-icon-orange" aria-hidden="true"><CategoryIconTile category="teams" size="sm" /></span>
                <span className="hc-mobile-card-copy"><strong>{t("professionalTeams")}</strong><small>{profile?.account_type === "fan" ? "Follow your team" : t("researchClubsBeforeSign")}</small></span>
                <span className="hc-mobile-row-arrow" aria-hidden="true"><HoopIcon name="arrow-right" size={17} /></span>
              </Link>
              <Link href="/womens" className="hc-mobile-category-row">
                <span className="hc-mobile-category-icon hc-icon-pink" aria-hidden="true"><CategoryIconTile category="womens" size="sm" /></span>
                <span className="hc-mobile-card-copy"><strong>{t("womensBasketball")}</strong><small>{profile?.account_type === "fan" ? "Follow your team and see what the players say" : t("discoverWomenWorldwide")}</small></span>
                <span className="hc-mobile-row-arrow" aria-hidden="true"><HoopIcon name="arrow-right" size={17} /></span>
              </Link>
              <Link href="/coaches" className="hc-mobile-category-row">
                <span className="hc-mobile-category-icon hc-icon-blue" aria-hidden="true"><CategoryIconTile category="coaches" size="sm" /></span>
                <span className="hc-mobile-card-copy"><strong>{t("coaches")}</strong><small>{profile?.account_type === "fan" ? "See what the players say" : t("learnFromPlayerFeedback")}</small></span>
                <span className="hc-mobile-row-arrow" aria-hidden="true"><HoopIcon name="arrow-right" size={17} /></span>
              </Link>
              <Link href="/leagues" className="hc-mobile-category-row">
                <span className="hc-mobile-category-icon hc-icon-green" aria-hidden="true"><CategoryIconTile category="leagues" size="sm" /></span>
                <span className="hc-mobile-card-copy"><strong>{t("leaguesCompetitions")}</strong><small>{t("exploreLeaguesByCountry")}</small></span>
                <span className="hc-mobile-row-arrow" aria-hidden="true"><HoopIcon name="arrow-right" size={17} /></span>
              </Link>
              <Link href="/players" className="hc-mobile-category-row">
                <span className="hc-mobile-category-icon hc-icon-purple" aria-hidden="true"><CategoryIconTile category="players" size="sm" /></span>
                <span className="hc-mobile-card-copy"><strong>{t("findPlayers")}</strong><small>{t("connectBasketballPlayers")}</small></span>
                <span className="hc-mobile-row-arrow" aria-hidden="true"><HoopIcon name="arrow-right" size={17} /></span>
              </Link>
              <Link href="/search" className="hc-mobile-category-row">
                <span className="hc-mobile-category-icon hc-icon-yellow" aria-hidden="true"><CategoryIconTile category="reviews" size="sm" /></span>
                <span className="hc-mobile-card-copy"><strong>{t("reviewsExperiences")}</strong><small>{profile?.account_type === "fan" ? "See what the players say" : t("makeCareerDecisions")}</small></span>
                <span className="hc-mobile-row-arrow" aria-hidden="true"><HoopIcon name="arrow-right" size={17} /></span>
              </Link>
            </div>
          </section>
        </section>

        {profile?.account_type === "fan" && <section className="grid fan-dashboard-grid" style={{ marginTop: 18 }}>
          <div className="dashboard-card fan-feature-card"><span className="card-kicker">{t("fanHQ")}</span><h2><HoopIcon name="basketball" size={20} /> {t("yourTeamHub")}</h2><p className="muted">{t("keepUpWithTeams")}</p><Link href="/teams" className="btn">{t("exploreTeams")}</Link></div>
          <div className="dashboard-card fan-feature-card"><span className="card-kicker">{t("proFan")}</span><h2><HoopIcon name="shield-check" size={20} /> {t("teamAlerts")}</h2><p className="muted">{t("teamAlertDescription")}</p><Link href="/teams" className="btn dark">{t("findTeamsToFollow")}</Link>{subscription?.plan === "premium" && activeMembership && <><Link href="/live-games" className="btn dark">{t("liveGamesHub")}</Link><Link href="/fan-live" className="btn dark">{t("openChatRoom")}</Link></>}</div>
          {subscription?.plan === "premium" && activeMembership ? <div className="dashboard-card fan-feature-card premium-fan-card"><span className="card-kicker">{t("premiumFan")}</span><h2><HoopIcon name="users" size={20} /> {t("fanBaseInsights")}</h2><p className="muted">{t("premiumFanInsights")}</p><strong>{followedTeams.length} {followedTeams.length===1?t("followedTeamCount"):t("followedTeamCountPlural")}</strong></div> : <div className="dashboard-card fan-feature-card"><span className="card-kicker">{t("premiumFan")}</span><h2>{t("unlockFanIntelligence")}</h2><p className="muted">{t("premiumFanInsights")}</p><Link href="/membership" className="btn">{t("explorePremium")}</Link></div>}
          <div className="dashboard-card fan-feature-card"><span className="card-kicker">{t("fanNetwork")}</span><h2>{t("connectWithFans")}</h2><p className="muted">{t("fanConnectionsDescription")}</p><Link href="/fans" className="btn">{t("findFans")}</Link></div>{followedTeams.length > 0 && <div className="dashboard-card fan-feature-card"><span className="card-kicker">{t("following")}</span><h2>{t("myTeams")}</h2><div className="fan-followed-list">{followedTeams.slice(0,6).map(team=><Link key={team.id} href={"/teams/"+team.id} className="fan-team-row"><span><strong>{team.name}</strong><small>{team.country || t("global")}{team.league_name ? " · "+team.league_name : ""}</small></span><span><HoopIcon name="chevron-right" size={16} /></span></Link>)}</div></div>}
        </section>}

        {["player","fan","scout","agent"].includes(profile?.account_type || "") && (
          <section className="dashboard-card" style={{ marginTop: 24 }}>
            <span className="card-kicker">{t("hoopFeed").toUpperCase()}</span>
            <h2>{activeMembership && (subscription?.plan === "pro" || subscription?.plan === "premium") ? t("hoopFeed") : t("unlockHoopFeed")}</h2>
            <p className="muted">{t("hoopFeedDescription")}</p>
            <Link href="/feed" className="btn">{activeMembership && (subscription?.plan === "pro" || subscription?.plan === "premium") ? t("openHoopFeed") : t("viewHoopFeed")}</Link>
          </section>
        )}

        {(profile?.account_type === "player" || profile?.account_type === "scout" || profile?.account_type === "agent") && (
          <section className="dashboard-card contact-dashboard-card" style={{ marginTop: 24 }}>
            <span className="card-kicker">{t("playerConnections")}</span>
            <h2>{profile.account_type === "player" ? t("recruitingRequests") : t("playerOutreach")}</h2>
            <p className="muted">{profile.account_type === "player" ? t("playerContactDescription") : t("scoutContactDescription")}</p>
            {profile.account_type === "player" ? <PlayerContactButton playerId={userId} /> : ["pro","premium"].includes(subscription?.plan || "") && activeMembership ? <Link href="/players" className="btn">{t("browsePlayers")}</Link> : <Link href="/membership" className="btn">{t("upgradeProPremium")}</Link>}
          </section>
        )}

        {profile?.account_type === "coach" && (
          <section className="dashboard-card" style={{ marginTop: 24 }}>
            <span className="card-kicker">{t("coachTeamPlacement")}</span>
            <h2>{profile.coach_verified ? t("requestCoachingAssignment") : t("verifyCoachIdentityFirst")}</h2>{profile?.coach_verified && coachRequests.some(r=>r.status==="approved") && <div className="card" style={{margin:"12px 0"}}><strong>{t("teamAssignment")}</strong><p className="muted">{coachTeams.find(t=>t.id===coachRequests.find(r=>r.status==="approved")?.team_id)?.name || t("assignedTeam")}</p></div>}
            <p className="muted">{profile.coach_verified ? t("coachPlacementDescription") : t("coachVerifyDescription")}</p>
            {!profile.coach_verified ? <Link href="/verification" className="btn">{t("verifyCoach")}</Link> : !activeMembership || !["pro","premium"].includes(subscription?.plan || "") ? <Link href="/membership" className="btn">{t("upgradeProPremium")}</Link> :
              <div style={{display:"grid",gap:10,marginTop:12}}>
                <select value={coachRequestTeam} onChange={e=>setCoachRequestTeam(e.target.value)}><option value="">{t("selectTeam")}</option>{coachTeams.map(t=><option key={t.id} value={t.id}>{t.name}{t.country ? " — "+t.country : ""}{t.league_name ? " · "+t.league_name : ""}</option>)}</select>
                <select value={coachRequestRole} onChange={e=>setCoachRequestRole(e.target.value)}><option>{t("headCoach")}</option><option>{t("assistantCoach")}</option><option>{t("associateHeadCoach")}</option><option>{t("playerDevelopmentCoach")}</option><option>{t("strengthConditioningCoach")}</option><option>{t("other")}</option></select>
                <textarea value={coachRequestNote} onChange={e=>setCoachRequestNote(e.target.value)} rows={3} maxLength={1000} placeholder={t("optionalAdminNote")} />
                <button className="btn" type="button" onClick={async()=>{setCoachRequestMessage(""); if(!coachRequestTeam){setCoachRequestMessage("Select a team.");return;} const {error}=await supabase.from("coach_team_requests").insert({user_id:userId,team_id:coachRequestTeam,requested_role:coachRequestRole,note:coachRequestNote.trim()||null}); if(error){setCoachRequestMessage(error.message);return;} setCoachRequestMessage("Request submitted. An admin will review it."); setCoachRequestNote(""); const {data}=await supabase.from("coach_team_requests").select("id,team_id,status,requested_role,reviewer_note").eq("user_id",userId).order("created_at",{ascending:false}).limit(20); setCoachRequests((data||[]) as any);}}>{t("requestTeamPlacement")}</button>
                {coachRequestMessage && <p className="muted">{coachRequestMessage}</p>}
                {coachRequests.length > 0 && <div className="card"><strong>{t("yourRequests")}</strong>{coachRequests.map(r=><p key={r.id} className="muted" style={{margin:"8px 0"}}>{coachTeams.find(t=>t.id===r.team_id)?.name || t("team")} · {r.requested_role || t("coach")} · <strong>{r.status}</strong>{r.reviewer_note ? " · "+r.reviewer_note : ""}</p>)}</div>}
              </div>}
          </section>
        )}

        <section className="grid" style={{ marginTop: 24 }}>
          <div className="dashboard-card">
            <span className="card-kicker">{t("membership")}</span>
            <h2>{planLabel}</h2>
            <p className="muted">
              {activeMembership
                ? t("activeResearchAccess")
                : t("unlockRatingsReviews")}
            </p>
            {subscription?.current_period_end && (
              <p className="muted">
                {t("currentPeriodEnds")}{" "}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            )}
            {subscription?.cancel_at_period_end && (
              <p className="muted">{t("cancellationScheduled")}</p>
            )}
            <Link href="/membership" className="btn">
              {activeMembership ? t("manageMembership") : t("viewMembership")}
            </Link>
          </div>

          {profile?.account_type === "player" && <div className="dashboard-card">
            <span className="card-kicker">{t("playerProfile")}</span>
            <h2>
              {profile?.player_verified ? <><VerifiedBadge label={t("verifiedPlayer")} /> {t("verifiedPlayer")}</> : t("buildPlayerProfile")}
            </h2>
            <p className="muted">
              {profile?.player_verified
                ? t("playerBadgeActive")
                : t("addBasketballBackground")}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/account" className="btn dark">{t("openAccount")}</Link>
              {userId && <Link href={`/players/${userId}`} className="btn dark">{t("profilePublic")}</Link>}
            </div>
          </div>}

          <Link href="/coaches" className="dashboard-card">
            <span className="card-kicker">{t("coaches").toUpperCase()}</span>
            <h2>{t("researchCoaches")}</h2>
            <p>{t("coachRatingsExperiences")}</p>
          </Link>

          <Link href="/teams" className="dashboard-card">
            <span className="card-kicker">{t("teams").toUpperCase()}</span>
            <h2>{t("researchTeams")}</h2>
            <p>{t("teamsBeforeMove")}</p>
          </Link>

          <Link href="/leagues" className="dashboard-card">
            <span className="card-kicker">{t("leagues").toUpperCase()}</span>
            <h2>{t("researchLeagues")}</h2>
            <p>{t("compareLeagueExperiences")}</p>
          </Link>

          <Link href="/search" className="dashboard-card">
            <span className="card-kicker">{t("discover")}</span>
            <h2>{t("searchHoopCheck")}</h2>
            <p>{t("findByName")}</p>
          </Link>
        </section>

        <section aria-labelledby="help-privacy-heading" style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <p className="eyebrow">{t("helpPrivacy")}</p>
            <h2 id="help-privacy-heading">{t("supportPoliciesHeading")}</h2>
            <p className="muted">{t("helpPoliciesDescription")}</p>
          </div>
          <div className="grid" style={{ gap: 12 }}>
            <Link href="/support" className="dashboard-card">
              <span className="card-kicker">{t("support")}</span>
              <h3>{t("contactSupport")}</h3>
              <p className="muted">{t("submitTicketTrack")}</p>
            </Link>
            <Link href="/terms" className="dashboard-card">
              <span className="card-kicker">{t("legal")}</span>
              <h3>{t("termsOfService")}</h3>
              <p className="muted">{t("readTerms")}</p>
            </Link>
            <Link href="/privacy" className="dashboard-card">
              <span className="card-kicker">{t("privacy")}</span>
              <h3>{t("privacyPolicy")}</h3>
              <p className="muted">{t("personalInfoHandled")}</p>
            </Link>
            <Link href="/community-guidelines" className="dashboard-card">
              <span className="card-kicker">{t("community")}</span>
              <h3>{t("communityGuidelines")}</h3>
              <p className="muted">{t("safeFairParticipation")}</p>
            </Link>
            <Link href="/privacy-center" className="dashboard-card">
              <span className="card-kicker">{t("yourData")}</span>
              <h3>{t("privacyRequestCenter")}</h3>
              <p className="muted">{t("requestDataActions")}</p>
            </Link>
            <Link href="/account" className="dashboard-card">
              <span className="card-kicker">{t("account").toUpperCase()}</span>
              <h3>{t("accountSettings")}</h3>
              <p className="muted">{t("manageProfilePrivacy")}</p>
            </Link>
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 }}>
            <div>
              <p className="eyebrow">{t("yourActivity")}</p>
              <h2>{t("reviewHistory")}</h2>
            </div>
            {profile?.account_type === "player" && <Link href="/search" className="btn">{t("writeReview")}</Link>}
          </div>

          <div className="grid">
            <div className="dashboard-card">
              <span className="card-kicker">{t("total")}</span>
              <h2>{reviews.length}</h2>
              <p className="muted">{t("reviewsSubmitted")}</p>
            </div>
            <div className="dashboard-card">
              <span className="card-kicker">{t("published")}</span>
              <h2>{reviewCounts.approved || 0}</h2>
              <p className="muted">{t("approvedReviews")}</p>
            </div>
            <div className="dashboard-card">
              <span className="card-kicker">{t("pending")}</span>
              <h2>{reviewCounts.pending || 0}</h2>
              <p className="muted">{t("awaitingModeration")}</p>
            </div>
            <div className="dashboard-card">
              <span className="card-kicker">{t("other")}</span>
              <h2>{(reviewCounts.rejected || 0) + (reviewCounts.flagged || 0) + (reviewCounts.removed || 0)}</h2>
              <p className="muted">{t("rejectedFlaggedRemoved")}</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {!reviews.length ? (
              <div className="dashboard-card">
                <h2>{t("noReviewsYet")}</h2>
                <p>
                  {t("firstHandExperienceHelp")}
                </p>
                <Link href="/search" className="btn dark">{t("findCoachTeamLeague")}</Link>
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
                      <strong>{t(review.status).toUpperCase()}</strong>
                    </div>
                    {review.title && <h3>{review.title}</h3>}
                    <p>{review.body}</p>
                    <p className="muted">
                      {t("overall")}: {review.overall_rating}/5 ·{" "}
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                    <Link href={target.href} className="btn dark">{t("viewProfile")}</Link>
                  </article>
                );
              })
            )}
          </div>

          {reviews.length > 5 && (
            <div style={{ marginTop: 16 }}>
              <Link href="/account" className="btn">{t("viewAllReviewsInAccount")}</Link>
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
                <h2>{t("adminControlCenter")}</h2>
                <p className="muted">
                  Manage directory data, rights, reviews, and moderation.
                </p>
              </div>
            </div>
            <div className="grid">
              <Link href="/admin/directory" className="dashboard-card">
                <span className="card-kicker">{t("admin")}</span>
                <h2>{t("openAdminPanel")}</h2>
                <p>{t("manageDirectoryOperations")}</p>
              </Link>
              <Link href="/admin/reviews" className="dashboard-card">
                <span className="card-kicker">{t("moderation")}</span>
                <h2>{t("manageReviews")}</h2>
                <p>{t("moderateSubmissions")}</p>
              </Link>
              <Link href="/admin/rights" className="dashboard-card">
                <span className="card-kicker">{t("legal")}</span>
                <h2>{t("rightsCoverage")}</h2>
                <p>{t("trackDataRights")}</p>
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
