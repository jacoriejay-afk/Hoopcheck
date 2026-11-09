"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import "../../hoopcheck-brand-team.css";

import { useParams } from "next/navigation";

import { supabase } from "../../../lib/supabase";
import { getHoopCheckEntitlements } from "../../../lib/membership-tier";
import { useLanguage } from "../../../components/LanguageProvider";
import { submitReviewReport } from "../../../lib/review-reports";
import HoopLoading from "../../../components/HoopLoading";
import ReviewCommunityActions from "../../../components/ReviewCommunityActions";
import WatchButton from "../../../components/WatchButton";
import { VerifiedBadge } from "../../../components/HoopCheckUI";
import TrustScoreDial from "../../../components/TrustScoreDial";
import ReviewMembershipGate from "../../../components/ReviewMembershipGate";
import ClaimProfileButton from "../../../components/ClaimProfileButton";
import OfficialReviewResponse from "../../../components/OfficialReviewResponse";

type Coach = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  current_team_id: string | null;
};

type Team = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  league_id: string | null;
  league_name: string | null;
};

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
};

type ReviewVerification = {
  review_id: string;
  player_verified: boolean | null;
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
};

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
    <div style={{ marginBottom: "18px" }}>
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

        <span style={{ color: "var(--orange)" }}>
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

export default function CoachDetailPage() {
  const { t } = useLanguage();
  const params = useParams();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [coach, setCoach] =
    useState<Coach | null>(null);

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

  const [team, setTeam] =
    useState<Team | null>(null);

  const [history, setHistory] = useState<any[]>([]);

  const [league, setLeague] =
    useState<League | null>(null);

  const [hasAccess, setHasAccess] =
    useState(false);
  const [accountType, setAccountType] = useState<string>("");
  const [reviewTier, setReviewTier] = useState<"free" | "pro" | "premium" | "member">("free");
  const [canReadFullReviews, setCanReadFullReviews] = useState(false);
  const [canWriteReviews, setCanWriteReviews] = useState(false);

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
    async function loadCoach() {
      if (!id) {
        setLoading(false);
        return;
      }

      const {
        data: coachData,
        error: coachError,
      } = await supabase
        .from("coaches")
        .select(
          "id, name, country, city, current_team_id"
        )
        .eq("id", id)
        .maybeSingle();

      if (
        coachError ||
        !coachData
      ) {
        setCoach(null);
        setLoading(false);
        return;
      }

      setCoach(coachData);
      setLoading(false);

      const { data: assignmentData } = await supabase.from("coach_team_assignments").select("id,team_id,role,season,start_date,end_date,active").eq("coach_id", id).eq("active", true).order("season", { ascending: false });
      if (assignmentData) {
        const teamIds = assignmentData.map((x) => x.team_id);
        const { data: teamRows } = teamIds.length ? await supabase.from("teams").select("id,name").in("id", teamIds) : { data: [] as any[] };
        setHistory(assignmentData.map((x) => ({ ...x, team: teamRows?.find((t) => t.id === x.team_id) })));
      }

      if (coachData.current_team_id) {
        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .select("id, name, country, city, league_id, league_name")
          .eq("id", coachData.current_team_id)
          .maybeSingle();

        if (!teamError && teamData) {
          setTeam(teamData);

          if (teamData.league_id) {
            const { data: leagueData, error: leagueError } = await supabase
              .from("leagues")
              .select("id, name, country, level")
              .eq("id", teamData.league_id)
              .maybeSingle();

            if (!leagueError && leagueData) {
              setLeague(leagueData);
            }
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
      setAccountType(profile?.account_type || "");

      const {
        data: subscription,
      } = await supabase
        .from("subscriptions")
        .select(
          "plan, status, access_status, current_period_end"
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

      const {
        data: adminResult,
        error: adminError,
      } = await supabase.rpc(
        "is_current_user_admin_or_moderator"
      );

      if (adminError) {
        console.error(
          "Admin check error:",
          adminError
        );
      }

      const entitlements = getHoopCheckEntitlements({
        accountType: profile?.account_type,
        subscription,
        isAdmin: adminResult === true,
      });
      setHasAccess(entitlements.hasPaidMembership);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const response = await fetch(`/api/review-access?entityType=coach&entityId=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${currentSession?.access_token || ""}` },
        cache: "no-store",
      });
      const reviewPayload = response.ok ? await response.json() : null;
      const tier = (reviewPayload?.tier || "free") as typeof reviewTier;
      setReviewTier(tier);
      const fullRead = reviewPayload?.canReadFull === true;
      setCanReadFullReviews(fullRead);
      setCanWriteReviews(reviewPayload?.canWrite === true);
      setHasAccess(entitlements.hasPaidMembership);
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

    loadCoach();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    if (!hasAccess) { setTrustScoreData(null); return () => { active = false; }; }
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/trust-score?entityType=coach&entityId=${encodeURIComponent(id)}`, {
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
      <main className="hc-entity-profile-page hc-coach-entity-profile">
<section className="hero hc-team-profile-hero hc-coach-profile-hero">
          <div className="eyebrow">
            HoopCheck
          </div>

          <HoopLoading label="Loading coach intelligence..." />
        </section>
      </main>
    );
  }

  if (!coach) {
    return (
      <main className="hc-entity-profile-page hc-coach-entity-profile">
<section className="hero">
          <div className="eyebrow">
            404
          </div>

          <h1>
            Coach not found.
          </h1>

          <p>
            We couldn&apos;t find that coach
            in the HoopCheck database.
          </p>

          <div className="actions">
            <Link
              href="/coaches"
              className="btn"
            >
              {t("backToCoaches")}
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
      : (publicSummary.overall_rating ?? 0);

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
    <main className="hc-entity-profile-page hc-coach-entity-profile">
      <nav className="hc-directory-switcher hc-profile-directory-switcher" aria-label="Browse HoopCheck directories">
        <span className="hc-directory-switcher-label">EXPLORE HOOPCHECK</span>
        <Link href="/teams">Men’s Teams</Link>
        <Link href="/womens">Women’s Teams</Link>
        <Link href="/coaches">Coaches</Link>
        <Link href="/leagues">Leagues</Link>
        {accountType !== "fan" && <Link href="/players">Players</Link>}
        <Link href="/search">Global Search</Link>
      </nav>
<section className="hero">
        <div className="eyebrow">
          Coach Research
        </div>

        <h1>
          {coach.name}
        </h1>
        {canReadFullReviews ? (
          <div className="hc-entity-trust-score"><TrustScoreDial score={trustScoreData?.score ?? null} explanation={trustScoreData?.explanation || (publicSummary.review_count > 0 ? t("trustScoreUnavailable") : t("noApprovedReviews"))} reviewCount={trustScoreData?.reviewCount ?? publicSummary.review_count} verifiedReviewCount={trustScoreData?.verifiedReviewCount ?? 0} /></div>
        ) : null}

        <div className="entity-actions"><WatchButton targetType="coach" targetId={coach.id} targetName={coach.name} />{canWriteReviews ? <Link href={`/coaches/${coach.id}/review`} className="btn">Write a Review</Link> : null}</div>
        <ClaimProfileButton entityType="coach" entityId={coach.id} entityName={coach.name} />

        <p>
          {coach.city &&
          coach.country
            ? `${coach.city}, ${coach.country}`
            : coach.country ||
              coach.city ||
              t("locationNotListed")}
        </p>

        <div className="actions">
          {accountType === "player" && canWriteReviews ? (
            <Link
              href={`/coaches/${coach.id}/review`}
              className="btn"
            >
              {t("writeAReview")}
            </Link>
          ) : null}

          <Link
            href="/coaches"
            className="btn dark"
          >
            {t("backToCoaches")}
          </Link>
        </div>
      </section>

      <section className="hero">
        <div className="eyebrow">Team History</div>
        <h2>Coach assignments</h2>
        {history.length ? <div className="grid" style={{ marginTop: "25px" }}>{history.map((item) => <div className="card" key={item.id}><div className="eyebrow">{item.season || t("seasonNotListed")}</div><h3>{item.team?.name || t("teamNotListed")}</h3><p>{item.role || t("coachingRoleNotListed")}</p>{item.start_date || item.end_date ? <p>{item.start_date || "—"} → {item.end_date || t("present")}</p> : null}</div>)}</div> : <div className="card"><p>{t("noHistoricalAssignments")}</p></div>}
      </section>

      <section className="grid">
        <div className="card">
          <div className="eyebrow">Current Team</div>
          {team ? (
            <>
              <h2>{team.name}</h2>
              <p>
                {team.city && team.country
                  ? team.city + ", " + team.country
                  : team.country || team.city || t("locationNotListed")}
              </p>
              {league && (
                <p style={{ color: "var(--orange)", fontWeight: 800 }}>
                  {league.name}
                </p>
              )}
              <Link href={"/teams/" + team.id} className="btn">
                View Team
              </Link>
            </>
          ) : (
            <>
              <h2>No current team listed.</h2>
              <p>HoopCheck has not linked this coach to a current organization yet.</p>
              <Link href="/teams" className="btn">
                Browse Teams
              </Link>
            </>
          )}
        </div>

        <div className="card">
          <div className="eyebrow">League</div>
          {league ? (
            <>
              <h2>{league.name}</h2>
              <p>
                {league.country || t("countryNotListed")}
                {league.level ? " • " + league.level : ""}
              </p>
              <Link href={"/leagues/" + league.id} className="btn">
                View League
              </Link>
            </>
          ) : team?.league_name ? (
            <>
              <h2>{team.league_name}</h2>
              <p>League relationship is available through the team record.</p>
              <Link href="/leagues" className="btn">
                Browse Leagues
              </Link>
            </>
          ) : (
            <>
              <h2>{t("leagueNotListed")}</h2>
              <p>HoopCheck has not linked this coach to a league yet.</p>
            </>
          )}
        </div>
      </section>

      {hasAccess && (
        <>
        <section className="grid">
          <div className="card">
            <div className="eyebrow">Overall Rating</div>
            <h2 style={{ fontSize: "58px", color: "var(--orange)", marginBottom: "4px" }}>
              {average.toFixed(1)}
            </h2>
            <p>Overall community rating</p>
          </div>
          {canReadFullReviews ? (
            <>
              <div className="card">
                <div className="eyebrow">Coach Breakdown</div>
                {reviews.length === 0 ? <p>{t("noApprovedReviewsYet")}</p> : <>
                  <RatingBar label="Communication" value={communication} />
                  <RatingBar label="Professionalism" value={professionalism} />
                  <RatingBar label="Development" value={development} />
                  <RatingBar label="Payment" value={payment} />
                </>}
              </div>
              <div className="card">
                <div className="eyebrow">Player Feedback</div>
                <h2>{reviews.length}</h2>
                <p>Approved player experiences currently available for this coach.</p>
                {canWriteReviews ? <Link href={"/coaches/" + coach.id + "/review"} className="btn">Add Your Experience</Link> : null}
              </div>
            </>
          ) : null}
        </section>

          <section className="hero">
            <div className="eyebrow">
              Approved Reviews
            </div>

            <h2>
              {accountType === "fan" ? "What the community is saying." : <>What players<br/>are saying.</>}
            </h2>

            {!canReadFullReviews ? (
              <ReviewMembershipGate
                title="Player reviews require an eligible membership"
                actionLabel="Upgrade"
                accountType={accountType}
                tier={reviewTier}
              />
            ) : reviewLoading ? (
              <p>
                Loading reviews...
              </p>
            ) : reviews.length ===
              0 ? (
              <div className="card">
                <h3>
                  {t("noApprovedReviewsYet")}
                </h3>

                <p>
                  {accountType === "fan" ? "No coach reviews have been published yet." : "Be one of the first players to share an experience with this coach."}
                </p>

                {canWriteReviews && <Link href={`/coaches/${coach.id}/review`} className="btn">{t("writeAReview")}</Link>}
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
                            {accountType === "fan" ? (review.is_anonymous ? "Anonymous review" : "Coach review") : (review.is_anonymous ? "Anonymous Player Review" : "Player Review")}
                          </div>

                          <h3>
                            {review.title || (accountType === "fan" ? "Coach review" : "Player experience")}
                          </h3>
                          {review.player_verified && (
                            <div className="hc-review-verified"><VerifiedBadge label={accountType === "fan" ? "Verified review" : "Verified player"} /><span>{accountType === "fan" ? "Verified review" : "Verified Player"}</span></div>
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
                      <OfficialReviewResponse reviewId={review.id} entityType="coach" entityId={coach.id} entityName={coach.name} />
                      <ReviewCommunityActions reviewId={review.id} />

                      <div className="review-footer">
                        <p
                          className="muted"
                          style={{
                            fontSize:
                              "13px",
                            margin: 0,
                          }}
                        >
                          {new Date(
                            review.created_at
                          ).toLocaleDateString()}
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
                          🚩 Report Review
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
                Select a reason
              </option>

              <option value="Spam or advertising">
                Spam or advertising
              </option>

              <option value="Harassment or abusive content">
                Harassment or abusive content
              </option>

              <option value="False or misleading information">
                False or misleading information
              </option>

              <option value="Personal information">
                Personal information
              </option>

              <option value="Threats or dangerous content">
                Threats or dangerous content
              </option>

              <option value="Other">
                Other
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
                  ? "Submitting..."
                  : "Submit Report"}
              </button>

              <button
                type="button"
                className="btn dark"
                onClick={closeReportModal}
                disabled={reportLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
