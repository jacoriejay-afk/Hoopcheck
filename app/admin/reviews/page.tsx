"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

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
  status: string;
  created_at: string;
};

type Report = {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
};

type AdminRole = {
  role: string;
};

export default function AdminReviewsPage() {
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [role, setRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAdminPage(userId: string) {
      const { data: adminRole, error: roleError } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (roleError || !adminRole) {
        router.replace("/dashboard");
        return;
      }

      const typedRole = adminRole as AdminRole;
      const normalizedRole = typedRole.role.trim().toLowerCase();

      if (
        normalizedRole !== "admin" &&
        normalizedRole !== "moderator"
      ) {
        router.replace("/dashboard");
        return;
      }

      setRole(normalizedRole);

      await loadReviews();
      await loadReports();

      if (mounted) {
        setLoading(false);
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
        router.replace("/login");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userError || !user) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      await loadAdminPage(user.id);
    }

    initializeAdminPage();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (!session?.user) {
          setLoading(false);
          router.replace("/login");
          return;
        }

        await loadAdminPage(session.user.id);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function loadReviews() {
    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
          id,
          author_id,
          coach_id,
          team_id,
          league_id,
          overall_rating,
          communication_rating,
          professionalism_rating,
          development_rating,
          payment_rating,
          title,
          body,
          status,
          created_at
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Error loading reviews:", error);

      setMessage(
        "Unable to load reviews. Make sure your account has an admin or moderator role."
      );

      return;
    }

    setReviews(data || []);
  }

  async function loadReports() {
    const { data, error } = await supabase
      .from("review_reports")
      .select(
        `
          id,
          review_id,
          reporter_id,
          reason,
          status,
          created_at
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Error loading reports:", error);
      return;
    }

    setReports(data || []);
  }

  async function updateReviewStatus(
    reviewId: string,
    status: "approved" | "rejected" | "flagged" | "removed"
  ) {
    setActionLoading(reviewId);
    setMessage("");

    const { error } = await supabase
      .from("reviews")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    if (error) {
      console.error("Error updating review:", error);

      setMessage(`Could not update review: ${error.message}`);

      setActionLoading(null);
      return;
    }

    setReviews((currentReviews) =>
      currentReviews.map((review) =>
        review.id === reviewId
          ? {
              ...review,
              status,
            }
          : review
      )
    );

    setMessage(`Review marked as ${status}.`);

    setActionLoading(null);
  }

  async function updateReportStatus(
    reportId: string,
    status: "resolved" | "dismissed"
  ) {
    setActionLoading(reportId);
    setMessage("");

    const { error } = await supabase
      .from("review_reports")
      .update({
        status,
      })
      .eq("id", reportId);

    if (error) {
      console.error("Error updating report:", error);

      setMessage(`Could not update report: ${error.message}`);

      setActionLoading(null);
      return;
    }

    setReports((currentReports) =>
      currentReports.map((report) =>
        report.id === reportId
          ? {
              ...report,
              status,
            }
          : report
      )
    );

    setMessage(`Report marked as ${status}.`);

    setActionLoading(null);
  }

  function getTarget(review: Review) {
    if (review.coach_id) {
      return `Coach ID: ${review.coach_id}`;
    }

    if (review.team_id) {
      return `Team ID: ${review.team_id}`;
    }

    if (review.league_id) {
      return `League ID: ${review.league_id}`;
    }

    return "Unknown target";
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

  const filteredReviews = reviews.filter((review) => {
    const matchesFilter =
      filter === "all" || review.status === filter;
    const searchText = search.trim().toLowerCase();
    const searchableText = [
      review.title,
      review.body,
      review.author_id,
      getTarget(review),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesFilter && searchableText.includes(searchText);
  });

  const pendingCount = reviews.filter(
    (review) => review.status === "pending"
  ).length;
  const pendingReportCount = reports.filter(
    (report) => report.status === "pending"
  ).length;

  if (loading) {
    return (
      <main className="moderation-page">
        <section className="hero moderation-hero">
          <div className="eyebrow">HOOPCHECK ADMIN</div>

          <h1>Loading moderation...</h1>

          <p className="muted">
            Checking your administrator permissions and moderation queue.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="moderation-page">
      <nav className="nav moderation-nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <section className="hero moderation-hero">
        <div className="eyebrow">HOOPCHECK ADMINISTRATION</div>

        <h1>Review Management</h1>

        <p>
          Review, approve, and moderate community feedback and reports.
        </p>

        <div className="admin-header-row">
          <div className="admin-role">
            <span className="admin-role-label">ACCESS LEVEL</span>
            <strong>{role}</strong>
          </div>

          <div className="admin-stats">
            <div className="admin-stat">
              <span>TOTAL REVIEWS</span>
              <strong>{reviews.length}</strong>
            </div>

            <div className="admin-stat">
              <span>PENDING REVIEWS</span>
              <strong>{pendingCount}</strong>
            </div>

            <div className="admin-stat">
              <span>PENDING REPORTS</span>
              <strong>{pendingReportCount}</strong>
            </div>
          </div>
        </div>

        {message && (
          <div className="admin-message">
            <span className="admin-message-dot" />
            <p>{message}</p>
          </div>
        )}
      </section>

      <section className="hero admin-section moderation-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">PLAYER FEEDBACK</div>
            <h2>Reviews</h2>
          </div>

          <span className="section-count">
            {filteredReviews.length} SHOWN
          </span>
        </div>

        <div className="moderation-controls">
          <label className="visually-hidden" htmlFor="review-search">
            Search reviews
          </label>
          <input
            id="review-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reviews..."
            className="moderation-search"
          />

          <label className="visually-hidden" htmlFor="review-status">
            Filter reviews by status
          </label>
          <select
            id="review-status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="moderation-filter"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="flagged">Flagged</option>
            <option value="removed">Removed</option>
          </select>
        </div>

        {filteredReviews.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">✓</div>

            <h2>
              {reviews.length === 0 ? "No reviews" : "No reviews found"}
            </h2>

            <p className="muted">
              {reviews.length === 0
                ? "There are currently no reviews to moderate."
                : "Try changing the search or status filter."}
            </p>
          </div>
        ) : (
          <div className="grid moderation-grid">
            {filteredReviews.map((review) => (
              <div className="card admin-review-card" key={review.id}>
                <div className="review-top">
                  <div>
                    <span className="review-label">OVERALL RATING</span>

                    <div className="rating-large">
                      <span className="rating-star">★</span>
                      {review.overall_rating}
                      <span className="rating-max">/ 5</span>
                    </div>
                  </div>

                  <span className={statusClass(review.status)}>
                    {review.status.toUpperCase()}
                  </span>
                </div>

                <div className="target-box">
                  <span className="review-label">TARGET</span>
                  <strong>{getTarget(review)}</strong>
                </div>

                {review.title && (
                  <div className="review-content">
                    <span className="review-label">TITLE</span>
                    <h3>{review.title}</h3>
                  </div>
                )}

                {review.body && (
                  <div className="review-content">
                    <span className="review-label">PLAYER REVIEW</span>
                    <p>{review.body}</p>
                  </div>
                )}

                <div className="rating-grid">
                  <div className="rating-item">
                    <span>Communication</span>
                    <strong>
                      {review.communication_rating ?? "N/A"}
                    </strong>
                  </div>

                  <div className="rating-item">
                    <span>Professionalism</span>
                    <strong>
                      {review.professionalism_rating ?? "N/A"}
                    </strong>
                  </div>

                  <div className="rating-item">
                    <span>Development</span>
                    <strong>
                      {review.development_rating ?? "N/A"}
                    </strong>
                  </div>

                  <div className="rating-item">
                    <span>Payment</span>
                    <strong>
                      {review.payment_rating ?? "N/A"}
                    </strong>
                  </div>
                </div>

                <div className="review-meta">
                  <p>
                    <span>AUTHOR ID</span>
                    {review.author_id}
                  </p>

                  <p>
                    <span>SUBMITTED</span>
                    {new Date(review.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="actions admin-actions">
                  <button
                    className="btn"
                    disabled={actionLoading === review.id}
                    onClick={() =>
                      updateReviewStatus(review.id, "approved")
                    }
                  >
                    {actionLoading === review.id
                      ? "Updating..."
                      : "Approve"}
                  </button>

                  <button
                    className="btn dark"
                    disabled={actionLoading === review.id}
                    onClick={() =>
                      updateReviewStatus(review.id, "rejected")
                    }
                  >
                    Reject
                  </button>

                  <button
                    className="btn dark"
                    disabled={actionLoading === review.id}
                    onClick={() =>
                      updateReviewStatus(review.id, "flagged")
                    }
                  >
                    Flag
                  </button>

                  <button
                    className="btn dark"
                    disabled={actionLoading === review.id}
                    onClick={() =>
                      updateReviewStatus(review.id, "removed")
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="hero admin-section moderation-section moderation-reports">
        <div className="section-heading">
          <div>
            <div className="eyebrow">SAFETY & MODERATION</div>
            <h2>Review Reports</h2>
          </div>

          <span className="section-count">
            {reports.length} TOTAL
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">✓</div>

            <h2>No reports</h2>

            <p className="muted">
              There are currently no review reports.
            </p>
          </div>
        ) : (
          <div className="grid">
            {reports.map((report) => (
              <div className="card admin-report-card" key={report.id}>
                <div className="review-top">
                  <div>
                    <span className="review-label">REPORT STATUS</span>

                    <h2 className="report-title">
                      Review Report
                    </h2>
                  </div>

                  <span className={reportStatusClass(report.status)}>
                    {report.status.toUpperCase()}
                  </span>
                </div>

                <div className="report-reason">
                  <span className="review-label">REASON</span>

                  <p>{report.reason}</p>
                </div>

                <div className="review-meta">
                  <p>
                    <span>REVIEW ID</span>
                    {report.review_id}
                  </p>

                  <p>
                    <span>REPORTER ID</span>
                    {report.reporter_id}
                  </p>

                  <p>
                    <span>SUBMITTED</span>
                    {new Date(report.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="actions admin-actions">
                  <button
                    className="btn"
                    disabled={actionLoading === report.id}
                    onClick={() =>
                      updateReportStatus(report.id, "resolved")
                    }
                  >
                    {actionLoading === report.id
                      ? "Updating..."
                      : "Resolve"}
                  </button>

                  <button
                    className="btn dark"
                    disabled={actionLoading === report.id}
                    onClick={() =>
                      updateReportStatus(report.id, "dismissed")
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
</main>
  );
}
