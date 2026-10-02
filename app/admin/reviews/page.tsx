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
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadAdminPage() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: adminRole, error: roleError } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleError || !adminRole) {
        router.replace("/dashboard");
        return;
      }

      const typedRole = adminRole as AdminRole;

      if (
        typedRole.role !== "admin" &&
        typedRole.role !== "moderator"
      ) {
        router.replace("/dashboard");
        return;
      }

      setRole(typedRole.role);

      await loadReviews();
      await loadReports();

      setLoading(false);
    }

    loadAdminPage();
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

  if (loading) {
    return (
      <main>
        <section className="hero">
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
    <main>
      <nav className="nav">
        <Link href="/" className="logo">
          Hoop<span>Check</span>
        </Link>

        <div className="links">
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">HOOPCHECK ADMINISTRATION</div>

        <h1>Review Moderation</h1>

        <p>
          Manage player reviews and reports before they appear publicly.
        </p>

        <div className="admin-header-row">
          <div className="admin-role">
            <span className="admin-role-label">ACCESS LEVEL</span>
            <strong>{role?.toUpperCase()}</strong>
          </div>

          <div className="admin-stats">
            <div className="admin-stat">
              <span>REVIEWS</span>
              <strong>{reviews.length}</strong>
            </div>

            <div className="admin-stat">
              <span>REPORTS</span>
              <strong>{reports.length}</strong>
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

      <section className="hero admin-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">PLAYER FEEDBACK</div>
            <h2>Reviews</h2>
          </div>

          <span className="section-count">
            {reviews.length} TOTAL
          </span>
        </div>

        {reviews.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">✓</div>

            <h2>No reviews</h2>

            <p className="muted">
              There are currently no reviews to moderate.
            </p>
          </div>
        ) : (
          <div className="grid">
            {reviews.map((review) => (
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

      <section className="hero admin-section">
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

      <style jsx>{`
        .admin-header-row {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          gap: 20px;
          margin-top: 30px;
          flex-wrap: wrap;
        }

        .admin-role {
          min-width: 180px;
          padding: 18px 20px;
          border: 1px solid rgba(255, 106, 0, 0.35);
          border-radius: 14px;
          background: rgba(255, 106, 0, 0.08);
        }

        .admin-role-label,
        .review-label {
          display: block;
          margin-bottom: 7px;
          color: #ff8a1f;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .admin-role strong {
          font-size: 1.05rem;
          letter-spacing: 0.05em;
        }

        .admin-stats {
          display: flex;
          gap: 12px;
        }

        .admin-stat {
          min-width: 120px;
          padding: 16px 20px;
          border-radius: 14px;
          background: #111111;
          border: 1px solid #292929;
          text-align: center;
        }

        .admin-stat span {
          display: block;
          color: #999;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.1em;
        }

        .admin-stat strong {
          display: block;
          margin-top: 5px;
          color: #ff6a00;
          font-size: 1.7rem;
        }

        .admin-message {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 22px;
          padding: 14px 18px;
          border-radius: 12px;
          border: 1px solid rgba(255, 106, 0, 0.3);
          background: rgba(255, 106, 0, 0.08);
        }

        .admin-message p {
          margin: 0;
        }

        .admin-message-dot {
          width: 9px;
          height: 9px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #ff6a00;
          box-shadow: 0 0 12px rgba(255, 106, 0, 0.65);
        }

        .admin-section {
          padding-top: 20px;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 26px;
        }

        .section-heading h2 {
          margin: 0;
        }

        .section-count {
          padding: 8px 12px;
          border-radius: 999px;
          background: #111111;
          border: 1px solid #292929;
          color: #aaa;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .admin-review-card,
        .admin-report-card {
          overflow: hidden;
          border-top: 3px solid #ff6a00;
        }

        .review-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 20px;
        }

        .rating-large {
          display: flex;
          align-items: baseline;
          gap: 5px;
          font-size: 2rem;
          font-weight: 950;
          line-height: 1;
        }

        .rating-star {
          color: #ff6a00;
          font-size: 1.3rem;
        }

        .rating-max {
          color: #777;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .target-box {
          margin-bottom: 22px;
          padding: 14px 16px;
          border-radius: 10px;
          background: #111111;
          border-left: 3px solid #ff6a00;
        }

        .target-box strong {
          display: block;
          word-break: break-all;
          font-size: 0.82rem;
        }

        .review-content {
          margin-bottom: 20px;
        }

        .review-content h3 {
          margin: 0;
        }

        .review-content p {
          margin: 0;
          line-height: 1.7;
          color: #d3d3d3;
        }

        .rating-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin: 20px 0;
        }

        .rating-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid #292929;
          border-radius: 10px;
          background: #0d0d0d;
        }

        .rating-item span {
          color: #999;
          font-size: 0.78rem;
        }

        .rating-item strong {
          color: #ff8a1f;
        }

        .review-meta {
          padding-top: 15px;
          border-top: 1px solid #292929;
        }

        .review-meta p {
          margin: 7px 0;
          color: #777;
          font-size: 0.72rem;
          line-height: 1.5;
          word-break: break-all;
        }

        .review-meta span {
          margin-right: 7px;
          color: #aaa;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .admin-actions {
          margin-top: 20px;
        }

        .report-title {
          margin: 0;
        }

        .report-reason {
          margin-bottom: 20px;
          padding: 16px;
          border-radius: 10px;
          background: #111111;
        }

        .report-reason p {
          margin: 0;
          color: #ddd;
          line-height: 1.6;
        }

        .empty-state {
          text-align: center;
          padding: 45px 25px;
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          margin: 0 auto 18px;
          border-radius: 50%;
          background: rgba(255, 106, 0, 0.12);
          border: 1px solid rgba(255, 106, 0, 0.3);
          color: #ff6a00;
          font-size: 1.4rem;
          font-weight: 900;
        }

        @media (max-width: 700px) {
          .admin-stats {
            width: 100%;
          }

          .admin-stat {
            flex: 1;
            min-width: 0;
          }

          .rating-grid {
            grid-template-columns: 1fr;
          }

          .section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .review-top {
            flex-direction: column;
          }

          .admin-actions {
            flex-direction: column;
          }

          .admin-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
