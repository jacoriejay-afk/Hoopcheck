"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type ReviewStatus = "pending" | "approved" | "rejected" | "flagged" | "removed";
type ReportStatus = "open" | "resolved" | "dismissed";

type Review = {
  id: string;
  author_id: string;
  coach_id: string | null;
  team_id: string | null;
  league_id: string | null;
  overall_rating: number;
  communication_rating: number | null;
  professionalism_rating: number | null;
  development_rating: number | null;
  payment_rating: number | null;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  created_at: string;
};

type Report = {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
};

type ModerationEvent = {
  id: string;
  review_id: string | null;
  report_id: string | null;
  actor_id: string;
  entity_type: "review" | "report";
  from_status: string | null;
  to_status: string;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
};

type DirectoryItem = {
  id: string;
  name: string;
};

type ConfirmAction = {
  type: "review" | "report";
  id: string;
  action: ReviewStatus | Exclude<ReportStatus, "open">;
  label: string;
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [coaches, setCoaches] = useState<DirectoryItem[]>([]);
  const [teams, setTeams] = useState<DirectoryItem[]>([]);
  const [leagues, setLeagues] = useState<DirectoryItem[]>([]);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewFilter, setReviewFilter] =
    useState<"all" | ReviewStatus>("all");
  const [reportFilter, setReportFilter] =
    useState<"all" | ReportStatus>("all");
  const [selectedReview, setSelectedReview] =
    useState<Review | null>(null);
  const [moderationEvents, setModerationEvents] =
    useState<ModerationEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [confirmAction, setConfirmAction] =
    useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAdminPage() {
      const { data: isAdmin, error: roleError } = await supabase.rpc(
        "is_current_user_admin_or_moderator"
      );

      if (!mounted) return;

      if (roleError) {
        console.error("Unable to verify moderation access:", roleError);
        setError("Unable to verify moderation access.");
        setLoading(false);
        return;
      }

      if (!isAdmin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      await loadAdminData();

      if (mounted) {
        setLoading(false);
      }
    }

    async function loadAdminData() {
      const [
        reviewsResult,
        reportsResult,
        profilesResult,
        coachesResult,
        teamsResult,
        leaguesResult,
      ] = await Promise.all([
        supabase
          .from("reviews")
          .select(
            `
              id, author_id, coach_id, team_id, league_id, player_season,
              overall_rating, communication_rating,
              professionalism_rating, development_rating,
              payment_rating, title, body, status, created_at
            `
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("review_reports")
          .select("id, review_id, reporter_id, reason, status, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, display_name"),
        supabase.from("coaches").select("id, name").order("name"),
        supabase.from("teams").select("id, name").order("name"),
        supabase.from("leagues").select("id, name").order("name"),
      ]);

      if (!mounted) return;
      if (reviewsResult.error) {
        console.error("Error loading reviews:", reviewsResult.error);
        setError("Unable to load reviews.");
        return;
      }
      if (reportsResult.error) {
        console.error("Error loading reports:", reportsResult.error);
        setError("Unable to load reports.");
        return;
      }

      setReviews((reviewsResult.data || []) as Review[]);
      setReports((reportsResult.data || []) as Report[]);

      if (profilesResult.error) {
        console.error("Error loading profile names:", profilesResult.error);
      } else {
        setProfiles((profilesResult.data || []) as Profile[]);
      }
      if (coachesResult.error) {
        console.error("Error loading coach names:", coachesResult.error);
      } else {
        setCoaches((coachesResult.data || []) as DirectoryItem[]);
      }
      if (teamsResult.error) {
        console.error("Error loading team names:", teamsResult.error);
      } else {
        setTeams((teamsResult.data || []) as DirectoryItem[]);
      }
      if (leaguesResult.error) {
        console.error("Error loading league names:", leaguesResult.error);
      } else {
        setLeagues((leaguesResult.data || []) as DirectoryItem[]);
      }
    }

    async function initializeAdminPage() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError || !session?.user) {
        setLoading(false);
        window.location.href = "/login";
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userError || !user) {
        setLoading(false);
        window.location.href = "/login";
        return;
      }

      await loadAdminPage();
    }

    initializeAdminPage();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          setLoading(false);
          window.location.href = "/login";
          return;
        }

        await loadAdminPage();
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const profileMap = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.id,
          profile.display_name || "Unknown user",
        ])
      ),
    [profiles]
  );
  const coachMap = useMemo(
    () => new Map(coaches.map((item) => [item.id, item.name])),
    [coaches]
  );
  const teamMap = useMemo(
    () => new Map(teams.map((item) => [item.id, item.name])),
    [teams]
  );
  const leagueMap = useMemo(
    () => new Map(leagues.map((item) => [item.id, item.name])),
    [leagues]
  );

  const getTargetName = useCallback(
    (review: Review) => {
      if (review.coach_id) {
        return coachMap.get(review.coach_id) || "Unknown coach";
      }
      if (review.team_id) {
        return teamMap.get(review.team_id) || "Unknown team";
      }
      if (review.league_id) {
        return leagueMap.get(review.league_id) || "Unknown league";
      }
      return "Unknown target";
    },
    [coachMap, leagueMap, teamMap]
  );

  const pendingReviews = reviews.filter(
    (review) => review.status === "pending"
  ).length;
  const flaggedReviews = reviews.filter(
    (review) => review.status === "flagged"
  ).length;
  const openReports = reports.filter(
    (report) => report.status === "open"
  ).length;
  const approvedReviews = reviews.filter(
    (review) => review.status === "approved"
  ).length;

  const filteredReviews = useMemo(() => {
    const search = reviewSearch.trim().toLowerCase();

    return reviews.filter((review) => {
      if (reviewFilter !== "all" && review.status !== reviewFilter) {
        return false;
      }
      if (!search) return true;

      const searchableText = [
        getTargetName(review),
        profileMap.get(review.author_id),
        review.title,
        review.body || "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [getTargetName, profileMap, reviewFilter, reviewSearch, reviews]);

  const filteredReports = useMemo(
    () =>
      reports.filter(
        (report) =>
          reportFilter === "all" || report.status === reportFilter
      ),
    [reportFilter, reports]
  );

  function getTargetType(review: Review) {
    if (review.coach_id) return "Coach";
    if (review.team_id) return "Team";
    if (review.league_id) return "League";
    return "Unknown";
  }

  function requestReviewAction(
    review: Review,
    action: ReviewStatus,
    label: string
  ) {
    setConfirmAction({ type: "review", id: review.id, action, label });
  }

  function requestReportAction(
    report: Report,
    action: Exclude<ReportStatus, "open">,
    label: string
  ) {
    setConfirmAction({ type: "report", id: report.id, action, label });
  }

  async function confirmModerationAction() {
    if (!confirmAction) return;

    const action = confirmAction;
    setActionLoading(action.id);
    setError("");

    const endpoint =
      action.type === "review"
        ? `/api/admin/reviews/${encodeURIComponent(action.id)}`
        : `/api/admin/review-reports/${encodeURIComponent(action.id)}`;
    const errorMessage = await updateModerationRecord(
      endpoint,
      action.action
    );

    if (errorMessage) {
      setError(errorMessage);
      setActionLoading(null);
      return;
    }

    if (action.type === "review") {
      const status = action.action as ReviewStatus;
      setReviews((current) =>
        current.map((review) =>
          review.id === action.id ? { ...review, status } : review
        )
      );
      setSelectedReview((current) =>
        current?.id === action.id ? { ...current, status } : current
      );
    } else {
      const status = action.action as Exclude<ReportStatus, "open">;
      setReports((current) =>
        current.map((report) =>
          report.id === action.id ? { ...report, status } : report
        )
      );
    }

    setConfirmAction(null);
    setActionLoading(null);
  }

  async function updateModerationRecord(
    endpoint: string,
    status: string
  ): Promise<string | null> {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Unable to read moderation session:", sessionError);
      return "Could not verify your session. Please try again.";
    }

    if (!session?.access_token) {
      return "Your session has expired. Please log in again.";
    }

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const result: { error?: string } = await response.json();

      if (!response.ok) {
        return result.error || "The moderation update failed.";
      }

      return null;
    } catch (error) {
      console.error("Moderation update request failed:", error);
      return "The moderation request failed. Please try again.";
    }
  }

  function statusClass(status: string) {
    switch (status) {
      case "approved":
        return "status-approved";

      case "rejected":
        return "status-rejected";

      case "flagged":
        return "status-flagged";

      case "removed":
        return "status-removed";

      case "pending":
      default:
        return "status-pending";
    }
  }

  function reportStatusClass(status: string) {
    switch (status) {
      case "resolved":
        return "status-approved";

      case "dismissed":
        return "status-rejected";

      default:
        return "status-pending";
    }
  }

  async function openReviewDetails(review: Review) {
    setSelectedReview(review);
    setEventsLoading(true);
    setModerationEvents([]);

    const { data, error } = await supabase
      .from("review_moderation_events")
      .select(
        "id, review_id, report_id, actor_id, entity_type, from_status, to_status, created_at"
      )
      .eq("review_id", review.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load moderation history:", error);
    } else {
      setModerationEvents((data || []) as ModerationEvent[]);
    }

    setEventsLoading(false);
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString();
  }

  function rating(value: number | null) {
    if (value === null || value === undefined) return "—";
    return `${Number(value).toFixed(1)}/5`;
  }

  if (loading) {
    return (
      <main className="page-shell review-moderation-center">
        <div className="container">
          <div className="admin-panel">
            <p className="eyebrow">HOOPCHECK ADMIN</p>
            <h1>Loading moderation center…</h1>
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="page-shell review-moderation-center">
        <div className="container">
          <div className="admin-panel">
            <p className="eyebrow">ACCESS DENIED</p>
            <h1>Admin access required</h1>
            <p className="muted">
              You must be an administrator or moderator to access this page.
            </p>
            {error && <div className="alert alert-error">{error}</div>}
            <Link href="/dashboard" className="btn">
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell review-moderation-center">
      <div className="container">
        <div className="admin-topbar">
          <div>
            <p className="eyebrow">HOOPCHECK ADMIN</p>
            <h1>Review Moderation</h1>
            <p className="muted">
              Review player feedback, investigate reports, and moderate safely.
            </p>
          </div>

          <Link href="/dashboard" className="btn dark">
            Dashboard
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <section className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>Pending Reviews</span>
            <strong>{pendingReviews}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Flagged Reviews</span>
            <strong>{flaggedReviews}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Open Reports</span>
            <strong>{openReports}</strong>
          </div>
          <div className="admin-stat-card">
            <span>Approved Reviews</span>
            <strong>{approvedReviews}</strong>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">REVIEWS</p>
              <h2>Review Queue</h2>
            </div>
          </div>

          <div className="admin-filters">
            <label className="visually-hidden" htmlFor="review-search">
              Search reviews
            </label>
            <input
              id="review-search"
              className="input"
              value={reviewSearch}
              onChange={(event) => setReviewSearch(event.target.value)}
              placeholder="Search target, author, title, or review text"
            />

            <label className="visually-hidden" htmlFor="review-filter">
              Filter reviews
            </label>
            <select
              id="review-filter"
              className="input"
              value={reviewFilter}
              onChange={(event) =>
                setReviewFilter(event.target.value as "all" | ReviewStatus)
              }
            >
              <option value="all">All review statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="flagged">Flagged</option>
              <option value="rejected">Rejected</option>
              <option value="removed">Removed</option>
            </select>
          </div>

          <div className="admin-list">
            {filteredReviews.length === 0 ? (
              <div className="empty-state">No reviews match your filters.</div>
            ) : (
              filteredReviews.map((review) => (
                <article className="moderation-card" key={review.id}>
                  <div className="moderation-card-header">
                    <div>
                      <span className={`status-pill ${statusClass(review.status)}`}>
                        {review.status.toUpperCase()}
                      </span>
                      <h3>{review.title || "Untitled review"}</h3>
                      <p className="muted">
                        {getTargetType(review)} · {getTargetName(review)}
                      </p>
                    </div>
                    <strong className="rating-number">
                      {rating(review.overall_rating)}
                    </strong>
                  </div>

                  {review.body && (
                    <p className="moderation-preview">
                      {review.body.length > 240
                        ? `${review.body.slice(0, 240)}…`
                        : review.body}
                    </p>
                  )}

                  <div className="moderation-meta">
                    <span>
                      Author: {profileMap.get(review.author_id) || "Unknown user"}
                    </span>
                    <span>{formatDate(review.created_at)}</span>
                  </div>

                  <div className="moderation-actions">
                    <button
                      className="btn dark"
                      onClick={() => openReviewDetails(review)}
                    >
                      View details
                    </button>
                    {review.status === "pending" && (
                      <>
                        <button
                          className="btn"
                          onClick={() =>
                            requestReviewAction(review, "approved", "Approve review")
                          }
                        >
                          Approve
                        </button>
                        <button
                          className="btn dark"
                          onClick={() =>
                            requestReviewAction(review, "rejected", "Reject review")
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {review.status === "flagged" && (
                      <>
                        <button
                          className="btn"
                          onClick={() =>
                            requestReviewAction(
                              review,
                              "approved",
                              "Approve flagged review"
                            )
                          }
                        >
                          Approve
                        </button>
                        <button
                          className="btn dark"
                          onClick={() =>
                            requestReviewAction(
                              review,
                              "removed",
                              "Remove flagged review"
                            )
                          }
                        >
                          Remove
                        </button>
                      </>
                    )}
                    {review.status === "approved" && (
                      <button
                        className="btn dark"
                        onClick={() =>
                          requestReviewAction(
                            review,
                            "removed",
                            "Remove approved review"
                          )
                        }
                      >
                        Remove
                      </button>
                    )}
                    {review.status === "rejected" && (
                      <button
                        className="btn"
                        onClick={() =>
                          requestReviewAction(
                            review,
                            "approved",
                            "Approve rejected review"
                          )
                        }
                      >
                        Approve
                      </button>
                    )}
                    {review.status === "removed" && (
                      <button
                        className="btn dark"
                        onClick={() =>
                          requestReviewAction(
                            review,
                            "approved",
                            "Restore removed review"
                          )
                        }
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">REPORTS</p>
              <h2>Review Reports</h2>
              <p className="muted">
                Report workflow: open → resolved or dismissed.
              </p>
            </div>
          </div>

          <div className="admin-filters">
            <label className="visually-hidden" htmlFor="report-filter">
              Filter reports
            </label>
            <select
              id="report-filter"
              className="input"
              value={reportFilter}
              onChange={(event) =>
                setReportFilter(event.target.value as "all" | ReportStatus)
              }
            >
              <option value="all">All report statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <div className="admin-list">
            {filteredReports.length === 0 ? (
              <div className="empty-state">No reports match your filters.</div>
            ) : (
              filteredReports.map((report) => {
                const linkedReview = reviews.find(
                  (review) => review.id === report.review_id
                );

                return (
                  <article className="moderation-card" key={report.id}>
                    <div className="moderation-card-header">
                      <div>
                        <span
                          className={`status-pill ${reportStatusClass(report.status)}`}
                        >
                          {report.status === "open"
                            ? "OPEN"
                            : report.status.toUpperCase()}
                        </span>
                        <h3>{report.reason}</h3>
                        <p className="muted">
                          Reported by{" "}
                          {profileMap.get(report.reporter_id) || "Unknown user"}
                        </p>
                      </div>
                      {linkedReview && (
                        <strong className="rating-number">
                          {rating(linkedReview.overall_rating)}
                        </strong>
                      )}
                    </div>

                    {linkedReview ? (
                      <p className="moderation-preview">
                        {linkedReview.title || "Untitled review"} ·{" "}
                        {getTargetName(linkedReview)}
                      </p>
                    ) : (
                      <p className="muted">
                        The linked review is no longer available.
                      </p>
                    )}

                    <div className="moderation-meta">
                      <span>Report ID: {report.id.slice(0, 8)}…</span>
                      <span>{formatDate(report.created_at)}</span>
                    </div>

                    <div className="moderation-actions">
                      {linkedReview && (
                        <button
                          className="btn dark"
                          onClick={() => openReviewDetails(linkedReview)}
                        >
                          View reported review
                        </button>
                      )}
                      {report.status === "open" && (
                        <>
                          <button
                            className="btn"
                            onClick={() =>
                              requestReportAction(
                                report,
                                "resolved",
                                "Resolve report"
                              )
                            }
                          >
                            Resolve
                          </button>
                          <button
                            className="btn dark"
                            onClick={() =>
                              requestReportAction(
                                report,
                                "dismissed",
                                "Dismiss report"
                              )
                            }
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      {selectedReview && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedReview(null)}
          role="presentation"
        >
          <section
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">REVIEW DETAILS</p>
                <h2 id="review-details-title">
                  {selectedReview.title || "Untitled review"}
                </h2>
                <p className="muted">
                  {getTargetType(selectedReview)} · {getTargetName(selectedReview)}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setSelectedReview(null)}
                aria-label="Close review details"
              >
                ×
              </button>
            </div>

            <div className="review-detail-grid">
              <div><span>Overall</span><strong>{rating(selectedReview.overall_rating)}</strong></div>
              <div><span>Communication</span><strong>{rating(selectedReview.communication_rating)}</strong></div>
              <div><span>Professionalism</span><strong>{rating(selectedReview.professionalism_rating)}</strong></div>
              <div><span>Development</span><strong>{rating(selectedReview.development_rating)}</strong></div>
              <div><span>Payment</span><strong>{rating(selectedReview.payment_rating)}</strong></div>
            </div>

            <div className="review-detail-body">
              <p>{selectedReview.body || "No written review provided."}</p>
            </div>

            <div className="moderation-meta">
              <span>
                Author: {profileMap.get(selectedReview.author_id) || "Unknown user"}
              </span>
              <span>Status: {selectedReview.status}</span>
              <span>{formatDate(selectedReview.created_at)}</span>
            </div>

            <div style={{ marginTop: "24px" }}>
              <p className="eyebrow">MODERATION HISTORY</p>
              {eventsLoading ? (
                <p className="muted">Loading audit history…</p>
              ) : moderationEvents.length === 0 ? (
                <p className="muted">No moderation actions recorded yet.</p>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {moderationEvents.map((event) => (
                    <div className="card" key={event.id}>
                      <strong>
                        {event.from_status || "created"} → {event.to_status}
                      </strong>
                      <p className="muted" style={{ marginBottom: 0 }}>
                        {event.entity_type} · {formatDate(event.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {confirmAction && (
        <div className="modal-backdrop">
          <section
            className="modal-panel confirmation-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-action-title"
          >
            <p className="eyebrow">CONFIRM ACTION</p>
            <h2 id="confirm-action-title">{confirmAction.label}</h2>
            <p className="muted">
              This action will change the moderation status. Please confirm
              before continuing.
            </p>
            <div className="confirmation-actions">
              <button
                className="btn dark"
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(actionLoading)}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={confirmModerationAction}
                disabled={Boolean(actionLoading)}
              >
                {actionLoading ? "Saving..." : "Confirm"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
