"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../../../components/LanguageProvider";

type ReviewVerification = {
  review_id: string;
  player_verified: boolean | null;
};

import Link from "next/link";
import "../../hoopcheck-brand-team.css";
import FanTeamPosts from "../../../components/FanTeamPosts";

import { useParams } from "next/navigation";

import { supabase } from "../../../lib/supabase";
import { hasActiveMembershipAtLeast } from "../../../lib/membership-tier";
import { submitReviewReport } from "../../../lib/review-reports";
import HoopLoading from "../../../components/HoopLoading";
import FollowButton from "../../../components/FollowButton";
import { VerifiedBadge } from "../../../components/HoopCheckUI";
import ReviewCommunityActions from "../../../components/ReviewCommunityActions";
import TrustScoreDial from "../../../components/TrustScoreDial";
import Surface from "../../../components/Surface";
import TeamRosterSpots from "../../../components/TeamRosterSpots";
import OfficialReviewResponse from "../../../components/OfficialReviewResponse";
import TeamPayTimeline from "../../../components/TeamPayTimeline";
import TeamLogo from "../../../components/TeamLogo";
import ClaimedTeamLogoEditor from "../../../components/ClaimedTeamLogoEditor";
import ClaimProfileButton from "../../../components/ClaimProfileButton";
import TeamOfficialUpdates from "../../../components/TeamOfficialUpdates";
import TeamPlayersHistory from "../../../components/TeamPlayersHistory";
import TeamFanGroupEntry from "../../../components/TeamFanGroupEntry";

type Team = {
  id: string;
  name: string;
  country: string | null;
  league_name: string | null;
  league_id: string | null;
  city: string | null;
  logo_url?: string | null;
  logo_bg?: "transparent" | "light" | "dark" | null;
};

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
};

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
};

type Review = {
  id: string;
  overall_rating: number;
  communication_rating: number | null;
  professionalism_rating: number | null;
  development_rating: number | null;
  payment_rating: number | null;
  pay_on_time_rating: number | null;
  housing_rating: number | null;
  medical_support_rating: number | null;
  coaching_quality_rating: number | null;
  facilities_rating: number | null;
  playing_time_honesty_rating: number | null;
  title: string | null;
  body: string;
  created_at: string;
  is_anonymous?: boolean;
  player_verified?: boolean;
  player_season?: string | null;
};

function averageCategory(
  reviews: Review[],
  key: "pay_on_time_rating" | "housing_rating" | "medical_support_rating" | "communication_rating" | "coaching_quality_rating" | "facilities_rating" | "playing_time_honesty_rating",
): number | null {
  const values = reviews.map(review => review[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function RatingBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const percentage = Math.max(
    0,
    Math.min(100, (value / 5) * 100)
  );

  return (
    <div
      style={{
        marginBottom: "18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "7px",
          fontSize: "13px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.4px",
        }}
      >
        <span>{label}</span>

        <span
          style={{
            color: "var(--orange)",
          }}
        >
          {value.toFixed(1)}
        </span>
      </div>

      <div
        style={{
          height: "8px",
          background: "#252525",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "var(--orange)",
            borderRadius: "999px",
          }}
        />
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  const { formatDate, t } = useLanguage();
  const params = useParams();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [team, setTeam] =
    useState<Team | null>(null);

  const [history, setHistory] = useState<any[]>([]);

  const [league, setLeague] =
    useState<League | null>(null);


  const [coaches, setCoaches] =
    useState<Coach[]>([]);

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [trustScoreData, setTrustScoreData] = useState<{score:number|null;reviewCount:number;verifiedReviewCount:number;explanation:string;averageRating:number|null}|null>(null);

  const [publicSummary, setPublicSummary] = useState({
    review_count: 0,
    overall_rating: null as number | null,
    communication_rating: null as number | null,
    professionalism_rating: null as number | null,
    development_rating: null as number | null,
    payment_rating: null as number | null,
  });

  const [hasAccess, setHasAccess] =
    useState(false);
  const [accountType, setAccountType] = useState<string>("");
  const [hasApprovedTeamClaim, setHasApprovedTeamClaim] = useState(false);
  const [membershipPlan, setMembershipPlan] = useState<string>("");
  const [knownPlayerFollowers, setKnownPlayerFollowers] = useState<string[]>([]);
  const [teamReviewCount, setTeamReviewCount] = useState(0);
  const [teamFollowerCount, setTeamFollowerCount] = useState(0);
  const [reviewTier, setReviewTier] = useState<"free" | "pro" | "premium" | "player" | "member">("free");

  const [loading, setLoading] =
    useState(true);

  const [reviewLoading, setReviewLoading] =
    useState(false);

  const [reportReviewId, setReportReviewId] =
    useState<string | null>(null);

  const [reportReason, setReportReason] =
    useState("");

  const [reportLoading, setReportLoading] =
    useState(false);

  const [reportMessage, setReportMessage] =
    useState("");

  useEffect(() => {
    async function loadTeam() {
      if (!id) {
        setLoading(false);
        return;
      }

      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("teams")
        .select(
          "id, name, country, league_name, league_id, city, logo_url, logo_bg"
        )
        .eq("id", id)
        .maybeSingle();

      if (
        teamError ||
        !teamData
      ) {
        setTeam(null);
        setLoading(false);
        return;
      }

      setTeam(teamData);
      setLoading(false);
      const { count: approvedReviewCount } = await supabase.from("reviews").select("id", { count: "exact", head: true }).eq("team_id", id).eq("status", "approved");
      setTeamReviewCount(approvedReviewCount || 0);

      const { data: membershipData } = await supabase.from("team_league_memberships").select("id,league_id,season,start_date,end_date,active").eq("team_id", id).eq("active", true).order("season", { ascending: false });
      if (membershipData) {
        const leagueIds = membershipData.map((x) => x.league_id);
        const { data: leagueRows } = leagueIds.length ? await supabase.from("leagues").select("id,name").in("id", leagueIds) : { data: [] as any[] };
        setHistory(membershipData.map((x) => ({ ...x, league: leagueRows?.find((l) => l.id === x.league_id) })));
      }

      const [leagueResult, coachesResult] =
        await Promise.all([
          teamData.league_id
            ? supabase
                .from("leagues")
                .select("id, name, country, level")
                .eq("id", teamData.league_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from("coaches")
            .select("id, name, country, city")
            .eq("current_team_id", id)
            .eq("active", true)
            .order("name"),
        ]);

      if (!leagueResult.error && leagueResult.data) {
        setLeague(leagueResult.data);
      }

      if (!coachesResult.error && coachesResult.data) {
        setCoaches(coachesResult.data);
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (user) {
        const { data: sharedProfiles } = await supabase.rpc("get_shared_team_followers", { p_team_id: id });
        setKnownPlayerFollowers((sharedProfiles || []).map((row: any) => row.display_name).filter(Boolean));
      }
      if (!user) {
        setLoading(false);
        return;
      }

      const [
        profileResult,
        subscriptionResult,
        adminResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("account_type")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("subscriptions")
          .select(
            "plan, status, current_period_end"
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle(),

        supabase.rpc(
          "is_current_user_admin_or_moderator"
        ),
      ]);

      const subscription =
        subscriptionResult.data;
      setAccountType(profileResult.data?.account_type || "");
      // Team Portal belongs to the approved representative of THIS club, not every manager.
      const { data: approvedTeamClaim } = await supabase
        .from("profile_claim_requests")
        .select("id")
        .eq("requester_id", user.id)
        .eq("entity_type", "team")
        .eq("entity_id", id)
        .eq("status", "approved")
        .maybeSingle();
      setHasApprovedTeamClaim(Boolean(approvedTeamClaim));
      setMembershipPlan(subscription?.plan || "");

      const currentPeriodEnd =
        subscription?.current_period_end
          ? new Date(
              subscription.current_period_end
            )
          : null;

      const subscriptionIsActive =
        (
          subscription?.status ===
            "active" ||
          subscription?.status ===
            "trialing"
        ) &&
        (
          !currentPeriodEnd ||
          currentPeriodEnd >
            new Date()
        );

      const isAdmin =
        adminResult.data === true;

      const fanHasPaidPlan =
        profileResult.data?.account_type !== "fan" ||
        hasActiveMembershipAtLeast(subscription);
      const access =
        (subscriptionIsActive && fanHasPaidPlan) ||
        isAdmin;

      setHasAccess(access);

      const response = await fetch(`/api/review-access?entityType=team&entityId=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
        cache: "no-store",
      });
      const reviewPayload = response.ok ? await response.json() : null;
      const tier = profileResult.data?.account_type === "player" ? "player" : ((reviewPayload?.tier || "free") as typeof reviewTier);
      setReviewTier(tier);
      const fullRead = ["premium", "player", "member"].includes(tier);
      const canReadAnything = tier !== "free";
      setHasAccess(canReadAnything);
      setReviewLoading(fullRead);
      const summary = reviewPayload?.summary;
      if (summary) {
        setPublicSummary({
          review_count: Number(summary.review_count || 0),
          overall_rating: summary.overall_rating == null ? null : Number(summary.overall_rating),
          communication_rating: summary.communication_rating == null ? null : Number(summary.communication_rating),
          professionalism_rating: summary.professionalism_rating == null ? null : Number(summary.professionalism_rating),
          development_rating: summary.development_rating == null ? null : Number(summary.development_rating),
          payment_rating: summary.payment_rating == null ? null : Number(summary.payment_rating),
        });
      }
      if (fullRead && Array.isArray(reviewPayload?.reviews)) {
        const reviewData = reviewPayload.reviews as Review[];
        const reviewIds = reviewData.map((review) => review.id);
        const { data: verificationData } = reviewIds.length
          ? await supabase.rpc("get_review_verification", { p_review_ids: reviewIds })
          : { data: [] };
        const verifiedByReview = Object.fromEntries((verificationData as ReviewVerification[] | null || []).map((item) => [item.review_id, Boolean(item.player_verified)]));
        setReviews(reviewData.map((review) => ({ ...review, player_verified: verifiedByReview[review.id] || false })));
      } else {
        setReviews([]);
      }
      setReviewLoading(false);

      setLoading(false);
    }

    loadTeam();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    if (!hasAccess) { setTrustScoreData(null); return () => { active = false; }; }
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/trust-score?entityType=team&entityId=${encodeURIComponent(id)}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}, cache: "no-store",
      });
      const payload = response.ok ? await response.json() : null;
      if (active && payload) setTrustScoreData(payload);
    })().catch(() => { if (active) setTrustScoreData(null); });
    return () => { active = false; };
  }, [id, hasAccess]);

  async function submitReport() {
    if (!reportReviewId) {
      return;
    }

    if (!reportReason) {
      setReportMessage(
        "Please select a reason for reporting this review."
      );
      return;
    }

    setReportLoading(true);
    setReportMessage("");

    const result = await submitReviewReport(
      reportReviewId,
      reportReason
    );

    if (!result.success) {
      setReportMessage(result.message);
      setReportLoading(false);
      return;
    }

    setReportMessage(
      "Report submitted. Our moderation team will review it."
    );

    setReportLoading(false);
  }

  function closeReportModal() {
    if (reportLoading) {
      return;
    }

    setReportReviewId(null);
    setReportReason("");
    setReportMessage("");
  }

  if (loading) {
    return (
      <main className="hc-entity-profile-page hc-team-entity-profile">
<section className="hero hc-team-profile-hero">
          <div className="eyebrow">
            HoopCheck
          </div>

          <HoopLoading label={t("loadingTeamIntelligence")} />
        </section>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="hc-entity-profile-page hc-team-entity-profile">
<section className="hero">
          <div className="eyebrow">
            404
          </div>

          <h1>
            Team not found.
          </h1>

          <p>
            We couldn&apos;t find that team
            in the HoopCheck database.
          </p>

          <div className="actions">
            <Link
              href="/teams"
              className="btn"
            >
              Back To Teams
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const average =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.overall_rating
            ),
          0
        ) / reviews.length
      : 0;

  const communication =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.communication_rating ||
                0
            ),
          0
        ) / reviews.length
      : 0;

  const professionalism =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.professionalism_rating ||
                0
            ),
          0
        ) / reviews.length
      : 0;

  const development =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.development_rating ||
                0
            ),
          0
        ) / reviews.length
      : 0;

  const payment =
    reviews.length > 0
      ? reviews.reduce(
          (
            total,
            review
          ) =>
            total +
            Number(
              review.payment_rating ||
                0
            ),
          0
        ) / reviews.length
      : 0;

  return (
    <main className="hc-entity-profile-page hc-team-entity-profile">

<section className="hero hc-team-profile-hero hc-social-profile-header hc-team-branded-hero" data-team-city={team.city || team.country || ""} style={{"--hc-team-hue": String([...team.name.toLowerCase()].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,7)%360)} as React.CSSProperties} id="overview" aria-labelledby="hc-team-profile-title">
        <span className="hc-team-art-label">Men’s basketball · AI arena artwork</span>
        <div className="hc-team-profile-identity">
          <TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={112} className="hc-team-profile-logo" />
          <div className="hc-team-profile-details">
            <p className="hc-team-profile-kicker">HOOPCHECK™ CLUB PROFILE</p>
            <h1 id="hc-team-profile-title" className={team.name.length > 28 ? "is-long-name" : ""}>{team.name}</h1>
            <p className="hc-team-profile-meta" title={[team.country || t("countryNotListed"), team.city, league?.name || team.league_name].filter(Boolean).join(" · ")}>
              <span>{team.city || team.country || t("countryNotListed")}</span>
              {team.city && team.country ? <span> · {team.country}</span> : null}
              {(league?.name || team.league_name) ? <span> · {league?.name || team.league_name}</span> : null}
            </p>
          </div>
          <div className="hc-team-profile-follow"><FollowButton targetType="team" targetId={team.id} variant="club" showCount={false} showNotifications={false} onCountChange={setTeamFollowerCount} /></div>
        </div>
        <div className="hc-team-profile-stats" aria-label="Team profile statistics">
          <div className="hc-team-profile-stat"><strong>{teamReviewCount}</strong><small>Reviews</small></div>
          <div className="hc-team-profile-stat hc-team-profile-stat--trust">
            {trustScoreData?.score == null ? <strong className="hc-team-profile-stat__missing">—</strong> : <span className="hc-team-profile-mini-ring"><TrustScoreDial score={trustScoreData.score} explanation={trustScoreData.explanation || t("trustScoreUnavailable")} reviewCount={trustScoreData.reviewCount} verifiedReviewCount={trustScoreData.verifiedReviewCount} /></span>}
            <small>Trust Score</small>
          </div>
          <div className="hc-team-profile-stat"><strong>{teamFollowerCount}</strong><small>Followers</small></div>
        </div>
      </section>
      <nav className="hc-team-profile-nav" aria-label="Team profile sections">
        <a href="#overview" aria-current="page">Overview</a>
        <a href="#reviews">Reviews</a>
        {accountType !== "fan" && <><a href="#players">Players</a><a href="#roster-board">Roster Board</a><a href="#pay-transparency">Pay Transparency</a></>}
        {accountType === "fan" && <a href="#fan-hq">Fan HQ</a>}
      </nav>
      <div className="hc-team-profile-overview-grid">
        <section className="hc-team-profile-about" aria-labelledby="hc-team-about-title">
          <p className="hc-team-profile-kicker">CLUB OVERVIEW</p>
          <h2 id="hc-team-about-title">About {team.name}</h2>
          <p>{team.name} is a basketball club{team.city ? ` based in ${team.city}` : team.country ? ` based in ${team.country}` : ""}{league?.name || team.league_name ? `, competing in ${league?.name || team.league_name}` : ""}.</p>
          <dl className="hc-team-profile-facts">
            <div><dt>League</dt><dd>{league?.name || team.league_name || "Not listed"}</dd></div>
            <div><dt>Location</dt><dd>{[team.city,team.country].filter(Boolean).join(", ") || "Not listed"}</dd></div>
          </dl>
        </section>
        <div id="fan-hq" className="hc-team-profile-community"><TeamFanGroupEntry teamId={team.id} /></div>
        <section className="hc-team-profile-snapshot" aria-labelledby="hc-team-snapshot-title">
          <p className="hc-team-profile-kicker">PLAYER EXPERIENCE</p>
          <h2 id="hc-team-snapshot-title">Trust Snapshot</h2>
          <p className="hc-team-profile-snapshot-note">{teamReviewCount > 0 ? `${teamReviewCount} published team reviews` : "No published reviews yet"}</p>
          {hasAccess && trustScoreData?.score != null ? <TrustScoreDial score={trustScoreData.score} explanation={trustScoreData.explanation || t("trustScoreUnavailable")} reviewCount={trustScoreData.reviewCount} verifiedReviewCount={trustScoreData.verifiedReviewCount} /> : <p className="hc-team-profile-snapshot-note">{accountType === "fan" ? "Full trust details require an eligible Fan membership." : "Trust details are available with an eligible membership."}</p>}
          <a href="#reviews" className="hc-team-profile-inline-link">Explore team reviews</a>
        </section>
      </div>

      {accountType !== "fan" && knownPlayerFollowers.length > 0 && <p className="hc-team-social-proof">Followed by players you follow: <strong>{knownPlayerFollowers.join(", ")}</strong></p>}
        <div className="entity-actions">{accountType === "player" ? <Link href={`/teams/${team.id}/review`} className="btn">Write a Review</Link> : null}{accountType !== "fan" && <ClaimProfileButton entityType="team" entityId={team.id} entityName={team.name} />}{accountType !== "fan" && hasApprovedTeamClaim && <Link href="/team-dashboard" className="btn dark">Team Portal</Link>}</div>
        {accountType !== "fan" && <ClaimedTeamLogoEditor teamId={team.id} teamName={team.name} onSaved={(logoUrl, logoBg) => setTeam(current => current ? { ...current, logo_url: logoUrl, logo_bg: logoBg } : current)} />}
        {["premium", "player", "member"].includes(reviewTier) && reviews[0] && <article className="card hc-team-overview-latest"><p className="eyebrow">{accountType === "fan" ? "LATEST TEAM REVIEW" : "LATEST PLAYER REVIEW"}</p><div className="hc-team-overview-latest__top"><h2>{reviews[0].title || (accountType === "fan" ? "Team review" : t("playerExperience"))}</h2><strong>{Number(reviews[0].overall_rating).toFixed(1)}/5</strong></div><p>{reviews[0].body}</p><p className="muted">{reviews[0].player_season || t("seasonNotRecorded")} · {formatDate(reviews[0].created_at)}</p></article>}
      {!hasAccess && reviewTier === "free" && accountType !== "player" ? (
        <section className="hero">
          <Surface className="card hc-team-membership-surface">
            <div className="eyebrow">{t("membershipRequired")}</div>
            {accountType === "fan" ? <>
              <h2>Full team reviews are available with Fan Premium</h2>
              <p>Unlock team ratings and reviews before you follow or support a club.</p>
              <div className="actions"><Link href="/membership" className="btn">View Fan Premium</Link></div>
            </> : <>
              <h2>Team reviews require an eligible membership</h2>
              <p>Sign in with an eligible active membership to view full team reviews and ratings.</p>
              <div className="actions"><Link href="/membership" className="btn">View Membership</Link><Link href="/login" className="btn dark">{t("logIn")}</Link></div>
            </>}
          </Surface>
        </section>
      ) : (
        <>
          <section className="hero" id="reviews">
            {["premium", "player", "member"].includes(reviewTier) ? (
              <Surface as="div" className="hc-entity-trust-score hc-team-reviews-trust-strip"><TrustScoreDial score={trustScoreData?.score ?? null} explanation={trustScoreData?.explanation || (publicSummary.review_count > 0 ? t("trustScoreUnavailable") : t("noApprovedPlayerReviewsYet"))} reviewCount={trustScoreData?.reviewCount ?? publicSummary.review_count} verifiedReviewCount={trustScoreData?.verifiedReviewCount ?? 0} /><div className="hc-team-score-categories" aria-label="Category ratings">{([{label:"Communication",value:publicSummary.communication_rating},{label:"Professionalism",value:publicSummary.professionalism_rating},{label:"Development",value:publicSummary.development_rating},{label:"Payment",value:publicSummary.payment_rating}] as const).filter(item => item.value !== null).map(item => <span key={item.label}><small>{item.label}</small><strong>{Number(item.value).toFixed(1)}</strong></span>)}</div></Surface>
            ) : null}
            {reviewTier === "pro" ? <Surface as="div" className="hc-entity-trust-score hc-membership-locked-score"><span className="eyebrow">Trust Score</span><h2>Premium</h2><Link href="/membership" className="btn">Upgrade</Link></Surface> : null}
            <div className="eyebrow">
              {accountType === "fan" ? "TEAM REVIEWS" : t("approvedReviewsHeading")}
            </div>

            <h2>
              {accountType === "fan" ? t("teamRatingsAtGlance") : t("whatPlayersAreSaying")}
            </h2>

            {reviewTier === "pro" ? (
              <div className="card hc-fan-review-teaser">
                <div className="hc-fan-upgrade-banner"><strong>You're seeing the outline — Fan Premium unlocks every review and rating</strong><Link href="/membership" className="btn">Upgrade</Link></div>
                <h3>{accountType === "fan" ? "Overall team rating" : "Overall player rating"}</h3>
                <div aria-label={publicSummary.overall_rating == null ? "Overall rating unavailable" : `Overall rating ${publicSummary.overall_rating.toFixed(1)} out of 5`} className="hc-review-star-row"><span aria-hidden="true">★★★★★</span>{publicSummary.overall_rating == null ? <span>—</span> : <strong>{publicSummary.overall_rating.toFixed(1)}/5</strong>}</div>
                <h3>Category breakdown</h3>
                <div className="hc-review-category-teaser">{["Communication","Professionalism","Development","Payment","Pay on time","Housing","Medical support","Coaching quality","Facilities","Playing time honesty"].map(label => <div key={label} className="hc-review-category-row"><span>{label}</span><span className="hc-review-score-blur" aria-label="Score available with Fan Premium">★★★★★</span></div>)}</div>
              </div>
            ) : reviewLoading ? (
              <p>
                {t("loadingReviews")}
              </p>
            ) : reviews.length ===
              0 ? (
              <div className="card">
                <h3>
                  {t("noApprovedReviewsYet")}
                </h3>

                <p>
                  {accountType === "fan" ? "No team reviews have been published yet." : t("firstPlayersShare")}
                </p>

                {accountType === "player" && <Link
                  href={`/teams/${team.id}/review`}
                  className="btn"
                >
                  {t("writeAReview")}
                </Link>}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "18px",
                  marginTop: "30px",
                }}
              >
                {reviews.map(
                  (review) => (
                    <article
                      className="card"
                      key={review.id}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: "12px",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <div>
                          <div className="eyebrow">
                            {accountType === "fan" ? (review.is_anonymous ? "Anonymous review" : "Team review") : (review.is_anonymous ? t("anonymousPlayerReview") : t("playerReview"))}
                          </div>
                          <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: 800, color: "var(--orange)" }}>
                            {accountType === "fan" ? "Season" : t("seasonPlayed")} {review.player_season || t("seasonNotRecorded")}
                          </div>

                          <h3>
                            {review.title || (accountType === "fan" ? "Team review" : t("playerExperience"))}
                          </h3>
                          {review.player_verified && (
                            <div className="hc-review-verified"><VerifiedBadge label={accountType === "fan" ? "Verified review" : t("verifiedPlayer")} /><span>{accountType === "fan" ? "Verified review" : t("verifiedPlayer")}</span></div>
                          )}
                        </div>

                        <strong
                          style={{
                            color:
                              "var(--orange)",
                            fontSize:
                              "24px",
                          }}
                        >
                          {Number(
                            review.overall_rating
                          ).toFixed(1)}
                        </strong>
                      </div>

                      <p>
                        {review.body}
                      </p>
                      <OfficialReviewResponse reviewId={review.id} entityType="team" entityId={team.id} entityName={team.name} />

                      <div className="review-footer">
                        <p
                          className="muted"
                          style={{
                            fontSize:
                              "13px",
                            margin: 0,
                          }}
                        >
                          {formatDate(review.created_at)}
                        </p>

                        <button
                          type="button"
                          className="report-button"
                          onClick={() => {
                            setReportReviewId(
                              review.id
                            );
                            setReportReason("");
                            setReportMessage("");
                          }}
                        >
                          {t("reportReview")}
                        </button>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        </>
      )}

      {accountType !== "fan" && <>
      <TeamPlayersHistory teamId={team.id} />
      <section className="hero" id="roster-board">
        <div className="eyebrow">ROSTER BOARD</div>
        <h2>Open roster spots</h2>
        <TeamRosterSpots teamId={team.id} teamName={team.name} />
      </section>
      <section className="hero" id="pay-transparency">
        <div className="eyebrow">PAY TRANSPARENCY</div>
        <h2>Payment history</h2>
        <TeamPayTimeline teamId={team.id} />
      </section>
      </>}

      {team && <><TeamOfficialUpdates teamId={team.id} /><FanTeamPosts teamId={team.id} /></>}

      {accountType === "player" && (
        <section className="hero hc-team-write-review"><div className="eyebrow">{t("shareYourExperience")}</div><h2>{t("writeAReviewTitle")}</h2><p className="muted">{t("helpNextPlayer")}</p><Link href={hasAccess ? `/teams/${team.id}/review` : "/membership"} className="btn">{hasAccess ? t("writeAReview") : t("unlockReviews")}</Link></section>
      )}

      {reportReviewId && (
        <div
          className="report-overlay"
          onClick={closeReportModal}
        >
          <div
            className="report-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="eyebrow">
              Review Safety
            </div>

            <h2>
              Report this review
            </h2>

            <p className="muted">
              Tell the HoopCheck moderation team
              why this review should be reviewed.
            </p>

            <label
              htmlFor="report-reason"
              className="report-label"
            >
              Reason
            </label>

            <select
              id="report-reason"
              value={reportReason}
              onChange={(event) =>
                setReportReason(
                  event.target.value
                )
              }
              disabled={reportLoading}
              className="report-select"
            >
              <option value="">
                {t("selectReportReason")}
              </option>

              <option value="Spam or advertising">
                {t("spamAdvertising")}
              </option>

              <option value="Harassment or abusive content">
                {t("harassmentAbusive")}
              </option>

              <option value="False or misleading information">
                {t("falseMisleading")}
              </option>

              <option value="Personal information">
                {t("personalInformation")}
              </option>

              <option value="Threats or dangerous content">
                {t("threatsDangerous")}
              </option>

              <option value="Other">
                {t("other")}
              </option>
            </select>

            {reportMessage && (
              <div className="report-message">
                {reportMessage}
              </div>
            )}

            <div className="actions report-actions">
              <button
                type="button"
                className="btn"
                onClick={submitReport}
                disabled={reportLoading}
              >
                {reportLoading
                  ? t("submittingReport")
                  : t("submitReport")}
              </button>

              <button
                type="button"
                className="btn dark"
                onClick={closeReportModal}
                disabled={reportLoading}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
