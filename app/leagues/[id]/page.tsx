"use client";

import HoopFeedFromEntity from "../../../components/HoopFeedFromEntity";
import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { useParams } from "next/navigation";

import { supabase } from "../../../lib/supabase";
import ReviewMembershipGate from "../../../components/ReviewMembershipGate";
import { useLanguage } from "../../../components/LanguageProvider";
import { submitReviewReport } from "../../../lib/review-reports";
import HoopLoading from "../../../components/HoopLoading";
import ReviewCommunityActions from "../../../components/ReviewCommunityActions";
import WatchButton from "../../../components/WatchButton";
import { VerifiedBadge } from "../../../components/HoopCheckUI";
import GeoBadge from "../../../components/GeoBadge";
import TeamLogo from "../../../components/TeamLogo";
import { countryFlag } from "../../../lib/countryFlag";

type League = {
  id: string;
  name: string;
  country: string | null;
  level: string | null;
  logo_url?: string | null;
};

type Team = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  league_id: string | null;
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

export default function LeagueDetailPage() {
  const { t } = useLanguage();
  const params = useParams();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [league, setLeague] =
    useState<League | null>(null);

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [publicSummary, setPublicSummary] = useState({
    review_count: 0,
    overall_rating: null as number | null,
    communication_rating: null as number | null,
    professionalism_rating: null as number | null,
    development_rating: null as number | null,
    payment_rating: null as number | null,
  });

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [teamHistory, setTeamHistory] = useState<any[]>([]);

  const [hasAccess, setHasAccess] =
    useState(false);
  const [accountType, setAccountType] = useState<string>("");
  const [canReadFullReviews, setCanReadFullReviews] = useState(false);
  const [canWriteReviews, setCanWriteReviews] = useState(false);
  const [reviewTier, setReviewTier] = useState<"free" | "pro" | "premium" | "member">("free");

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
    async function loadLeague() {
      if (!id) {
        setLoading(false);
        return;
      }

      const {
        data: leagueData,
        error: leagueError,
      } = await supabase
        .from("leagues")
        .select(
          "id, name, country, level, logo_url"
        )
        .eq("id", id)
        .maybeSingle();

      if (
        leagueError ||
        !leagueData
      ) {
        setLeague(null);
        setLoading(false);
        return;
      }

      setLeague(leagueData);

      // Some imported leagues are linked through team_league_memberships rather
      // than teams.league_id. Load both sources and union them so league pages
      // never silently omit clubs that are already in the active roster.
      const [directResult, membershipResult] = await Promise.all([
        supabase.from("teams")
          .select("id, name, country, city, league_id")
          .eq("league_id", id)
          .eq("active", true)
          .order("name"),
        supabase.from("team_league_memberships")
          .select("id,team_id,season,start_date,end_date,active")
          .eq("league_id", id)
          .eq("active", true)
          .order("season", { ascending: false }),
      ]);

      if (directResult.error) console.error("League direct team lookup failed:", directResult.error);
      if (membershipResult.error) console.error("League membership lookup failed:", membershipResult.error);
      const membershipRows = membershipResult.data || [];
      const teamIds = Array.from(new Set([
        ...(directResult.data || []).map((team) => team.id),
        ...membershipRows.map((membership) => membership.team_id),
      ]));
      const { data: linkedTeams, error: linkedTeamsError } = teamIds.length
        ? await supabase.from("teams")
            .select("id, name, country, city, league_id, active")
            .in("id", teamIds)
            .order("name")
        : { data: [], error: null };

      if (linkedTeamsError) console.error("League team detail lookup failed:", linkedTeamsError);
      const allTeams = linkedTeams || [];
      setTeams(allTeams.filter((team) => team.active).map(({ active: _active, ...team }) => team));
      setTeamHistory(membershipRows.map((membership) => ({
        ...membership,
        team: allTeams.find((team) => team.id === membership.team_id),
      })).filter((membership) => membership.team));

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const { data: profile } = await supabase.from("profiles")
          .select("account_type")
          .eq("id", user.id)
          .maybeSingle();
        setAccountType(profile?.account_type || "");
      } else {
        setAccountType("");
      }

      const accessResponse = await fetch(`/api/review-access?entityType=league&entityId=${encodeURIComponent(id)}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        cache: "no-store",
      });
      const accessPayload = accessResponse.ok ? await accessResponse.json() : null;
      const tier = (accessPayload?.tier || "free") as typeof reviewTier;
      const fullRead = accessPayload?.canReadFull === true;
      setReviewTier(tier);
      setHasAccess(tier !== "free");
      setCanReadFullReviews(fullRead);
      setCanWriteReviews(accessPayload?.canWrite === true);

      const summary = accessPayload?.summary;
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

      if (fullRead && Array.isArray(accessPayload?.reviews)) {
        setReviewLoading(true);
        const reviewData = accessPayload.reviews as Review[];
        const reviewIds = reviewData.map(review => review.id);
        const { data: verificationData } = reviewIds.length
          ? await supabase.rpc("get_review_verification", { p_review_ids: reviewIds })
          : { data: [] };
        const verifiedByReview = Object.fromEntries((verificationData as ReviewVerification[] | null || []).map(item => [item.review_id, Boolean(item.player_verified)]));
        setReviews(reviewData.map(review => ({ ...review, player_verified: verifiedByReview[review.id] || false })));
        setReviewLoading(false);
      } else {
        setReviews([]);
      }

      setLoading(false);
    }

    loadLeague();
  }, [id]);

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
      <main className="hc-entity-profile-page hc-league-entity-profile">
<section className="hero hc-team-profile-hero hc-league-profile-hero">
          <div className="eyebrow">
            HoopCheck
          </div>

          <HoopLoading label="Loading league intelligence..." />
        </section>
      </main>
    );
  }

  if (!league) {
    return (
      <main className="hc-entity-profile-page hc-league-entity-profile">
<section className="hero">
          <div className="eyebrow">
            404
          </div>

          <h1>
            League not found.
          </h1>

          <p>
            We couldn&apos;t find that league
            in the HoopCheck database.
          </p>

          <div className="actions">
            <Link
              href="/leagues"
              className="btn"
            >
              {t("backToLeagues")}
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
    <main className="hc-entity-profile-page hc-league-entity-profile">
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
          League Research
        </div>

        <div className="hc-league-hero-id">
          <span className="hc-dir-crest hc-dir-crest--league"><TeamLogo name={league.name} logoUrl={league.logo_url} size={72} /></span>
          {league.country ? <span className="hc-dir-flagchip">{countryFlag(league.country) ? <span className="hc-dir-flag" aria-hidden="true">{countryFlag(league.country)}</span> : null}<span>{league.country}</span></span> : null}
        </div>

        <h1>
          {league.name}
        </h1>

        <div className="entity-actions"><GeoBadge country={league.country} regional={league.country === "Europe"} /><WatchButton targetType="league" targetId={league.id} targetName={league.name} /></div>

        <p>
          {league.country ||
            t("countryNotListed")}
        </p>

        {league.level && (
          <p
            style={{
              color: "var(--orange)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontSize: "13px",
            }}
          >
            {league.level}
          </p>
        )}

        <div className="actions">
          {accountType === "player" ? (
            <Link href={canWriteReviews ? `/leagues/${league.id}/review` : "/membership"} className="btn">
              {canWriteReviews ? t("writeAReview") : t("becomeMemberToReview")}
            </Link>
          ) : null}

          <Link
            href="/leagues"
            className="btn dark"
          >
            {t("backToLeagues")}
          </Link>
        </div>
      </section>

      <section className="hero">
        <div className="eyebrow">Team Membership History</div>
        <h2>Teams by season</h2>
        {teamHistory.length ? <div className="grid" style={{ marginTop: "25px" }}>{teamHistory.map((item) => <div className="card" key={item.id}><div className="eyebrow">{item.season || t("seasonNotListed")}</div><h3>{item.team?.name || t("teamNotListed")}</h3><p>{item.start_date || t("startNotListed")} → {item.end_date || t("present")}</p></div>)}</div> : <div className="card"><p>{t("noHistoricalMemberships")}</p></div>}
      </section>

      <section className="hero">
        <div className="eyebrow">Teams In This League</div>
        <h2>Professional organizations</h2>
        <p>
          {teams.length > 0
            ? teams.length + " active team" + (teams.length === 1 ? "" : "s") + " currently linked to this league."
            : "No active teams are linked to this league yet."}
        </p>

        {teams.length > 0 && (
          <div className="grid" style={{ marginTop: "30px" }}>
            {teams.map((team) => (
              <Link
                key={team.id}
                href={"/teams/" + team.id}
                className="card"
                style={{ textDecoration: "none" }}
              >
                <div className="eyebrow">TEAM</div>
                <h3>{team.name}</h3>
                <p>
                  {team.city && team.country
                    ? team.city + ", " + team.country
                    : team.country || team.city || t("locationNotListed")}
                </p>
                <span className="btn">View Team</span>
              </Link>
            ))}
          </div>
        )}
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
              <div className="card">
                <div className="eyebrow">League Breakdown</div>
                {reviews.length === 0 ? <p>{t("noApprovedReviewsYet")}</p> : <>
                  <RatingBar label="Communication" value={communication} />
                  <RatingBar label="Professionalism" value={professionalism} />
                  <RatingBar label="Development" value={development} />
                  <RatingBar label="Payment" value={payment} />
                </>}
              </div>
            ) : null}

            {canWriteReviews ? (
              <div className="card">
                <div className="eyebrow">Player Feedback</div>
                <h2>{reviews.length}</h2>
                <p>Approved player experiences currently available for this league.</p>
                <Link href={`/leagues/${league.id}/review`} className="btn">Add Your Experience</Link>
              </div>
            ) : null}
          </section>

          <section className="hero">

            <div className="eyebrow">
              Approved Reviews
            </div>

            <h2>
              {accountType === "fan" ? "What the community is saying." : <>What players<br/>are saying.</>}
            </h2>

            {canReadFullReviews ? (reviewLoading ?
              <p>
                Loading reviews...
              </p>
            : reviews.length === 0 ? (
              <div className="card">
                <h3>
                  {t("noApprovedReviewsYet")}
                </h3>

                <p>
                  {accountType === "fan" ? "No league reviews have been published yet." : "Be one of the first players to share an experience with this league."}
                </p>

                {canWriteReviews ? (
                  <Link href={`/leagues/${league.id}/review`} className="btn">{t("writeAReview")}</Link>
                ) : null}
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
                            {accountType === "fan" ? (review.is_anonymous ? "Anonymous review" : "League review") : (review.is_anonymous ? "Anonymous Player Review" : "Player Review")}
                          </div>

                          <h3>
                            {review.title || (accountType === "fan" ? "League review" : "Player experience")}
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
            )) : null}
          </section>
        </>
      )}

      {!canReadFullReviews ? (
        <section className="hero">
          <ReviewMembershipGate
            title="Full league reviews require an eligible membership"
            description="Player Pro and Premium members and eligible non-fan members can read full league reviews. Fan accounts need Premium for full review details."
            actionLabel="View Membership"
            accountType={accountType}
            tier={reviewTier}
          />
        </section>
      ) : null}

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
      <HoopFeedFromEntity id={league.id} column="league_id" />
    </main>
  );
}
