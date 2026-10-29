"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../../../components/LanguageProvider";

type ReviewVerification = {
  review_id: string;
  player_verified: boolean | null;
};

import Link from "next/link";
import FanTeamPosts from "../../../components/FanTeamPosts";

import { useParams } from "next/navigation";

import { supabase } from "../../../lib/supabase";
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
  const [membershipPlan, setMembershipPlan] = useState<string>("");
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
        ["pro", "premium"].includes(subscription?.plan || "");
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

<section className="hero">
        <div className="hc-team-profile-heading hc-team-profile-heading--club"><TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={96} className="hc-team-profile-logo" /><div className="hc-team-profile-heading__copy"><p className="hc-team-profile-kicker">HOOPCHECK CLUB PROFILE</p><h1>{team.name}</h1><p className="hc-team-profile-meta"><span>{team.country || t("countryNotListed")}</span>{team.city ? <><span aria-hidden="true"> · </span><span>{team.city}</span></> : null}{(league?.name || team.league_name) ? <><span aria-hidden="true"> · </span><span>{league?.name || team.league_name}</span></> : null}</p></div></div>
        {reviewTier === "pro" ? (
          <Surface as="div" className="hc-entity-trust-score hc-membership-locked-score">
            <span className="eyebrow">Trust Score</span><h2>Premium</h2><Link href="/membership" className="btn">Upgrade</Link>
          </Surface>
        ) : ["premium", "player", "member"].includes(reviewTier) ? (
          <Surface as="div" className="hc-entity-trust-score"><TrustScoreDial score={trustScoreData?.score ?? null} explanation={trustScoreData?.explanation || (publicSummary.review_count > 0 ? t("trustScoreUnavailable") : t("noApprovedPlayerReviewsYet"))} reviewCount={trustScoreData?.reviewCount ?? publicSummary.review_count} verifiedReviewCount={trustScoreData?.verifiedReviewCount ?? 0} /></Surface>
        ) : (
          <Surface as="div" className="hc-entity-trust-score hc-membership-locked-score"><span className="eyebrow"><span aria-hidden="true">🔒</span> Player reviews are a Premium fan feature</span><Link href="/membership" className="btn">Upgrade</Link></Surface>
        )}

        <div className="entity-actions"><FollowButton targetType="team" targetId={team.id} variant="club" />{accountType === "player" ? <Link href={`/teams/${team.id}/review`} className="btn">Write a Review</Link> : null}</div>
        <ClaimedTeamLogoEditor teamId={team.id} teamName={team.name} onSaved={(logoUrl, logoBg) => setTeam(current => current ? { ...current, logo_url: logoUrl, logo_bg: logoBg } : current)} />
        <TeamRosterSpots teamId={team.id} teamName={team.name} />

      </section>
      <TeamPayTimeline teamId={team.id} />
      {!hasAccess ? (
        <section className="hero">
          <Surface className="card hc-team-membership-surface">
            <div className="eyebrow">{t("membersOnly")}</div>
            <h2>🔒 Player reviews are a Premium fan feature</h2>
            <p>Upgrade to Fan Premium to unlock every review, rating, category score, and Trust Score detail.</p>
            <div className="actions"><Link href="/membership" className="btn">Upgrade</Link><Link href="/login" className="btn dark">{t("logIn")}</Link></div>
          </Surface>
        </section>
      ) : (
        <>
          <section className="hero">
            {!hasAccess && (
              <div className="card" style={{ marginBottom: 24, borderColor: "rgba(255,106,0,.45)" }}>
                <div className="eyebrow">{t("membersOnlyTitle")}</div>
                <h3>{t("playerReviewsLocked")}</h3>
                <p>{t("membershipStartsMessage")}</p>
                <div className="actions">
                  <Link href="/signup" className="btn">{t("createFreeAccount")}</Link>
                  <Link href="/login" className="btn dark">{t("logIn")}</Link>
                </div>
              </div>
            )}
            <div className="eyebrow">
              {membershipPlan === "premium" && accountType === "fan" ? t("playerRatings") : t("approvedReviewsHeading")}
            </div>

            <h2>
              {membershipPlan === "premium" && accountType === "fan" ? t("teamRatingsAtGlance") : t("whatPlayersAreSaying")}
            </h2>

            {reviewTier === "pro" ? (
              <div className="card hc-fan-review-teaser">
                <div className="hc-fan-upgrade-banner"><strong>You're seeing the outline — Fan Premium unlocks every review and rating</strong><Link href="/membership" className="btn">Upgrade</Link></div>
                <h3>Overall player rating</h3>
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
                  {t("firstPlayersShare")}
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
                            {review.is_anonymous ? t("anonymousPlayerReview") : t("playerReview")}
                          </div>
                          <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: 800, color: "var(--orange)" }}>
                            {t("seasonPlayed")} {review.player_season || t("seasonNotRecorded")}
                          </div>

                          <h3>
                            {review.title || t("playerExperience")}
                          </h3>
                          {review.player_verified && (
                            <div className="hc-review-verified"><VerifiedBadge label={t("verifiedPlayer")} /><span>{t("verifiedPlayer")}</span></div>
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

      {team && <FanTeamPosts teamId={team.id} />}

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
