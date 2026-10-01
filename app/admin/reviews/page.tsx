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
  const [actionLoading, setActionLoading] = useState<string | null>(
    null
  );

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

      const { data: adminRole, error: roleError } =
        await supabase
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
      console.error(
        "Error loading reviews:",
        error
      );

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
      console.error(
        "Error loading reports:",
        error
      );

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
      console.error(
        "Error updating review:",
        error
      );

      setMessage(
        `Could not update review: ${error.message}`
      );

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

    setMessage(
      `Review marked as ${status}.`
    );

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
      console.error(
        "Error updating report:",
        error
      );

      setMessage(
        `Could not update report: ${error.message}`
      );

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

    setMessage(
      `Report marked as ${status}.`
    );

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

  if (loading) {
    return (
      <main>
        <section className="hero">
          <h1>Loading moderation...</h1>
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
          <Link href="/dashboard">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          HoopCheck Administration
        </div>

        <h1>Review Moderation</h1>

        <p>
          Manage player reviews and reports before
          they appear publicly.
        </p>

        <p className="muted">
          Your role: <strong>{role}</strong>
        </p>

        {message && (
          <div className="card">
            <p>{message}</p>
          </div>
        )}
      </section>

      <section className="hero">
        <h2>Reviews</h2>

        {reviews.length === 0 ? (
          <div className="card">
            <h2>No reviews</h2>

            <p className="muted">
              There are currently no reviews to
              moderate.
            </p>
          </div>
        ) : (
          <div className="grid">
            {reviews.map((review) => (
              <div
                className="card"
                key={review.id}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <h2>
                    ⭐ {review.overall_rating} / 5
                  </h2>

                  <span
                    className={statusClass(
                      review.status
                    )}
                  >
                    {review.status.toUpperCase()}
                  </span>
                </div>

                <p className="muted">
                  {getTarget(review)}
                </p>

                {review.title && (
                  <h3>{review.title}</h3>
                )}

                {review.body && (
                  <p>{review.body}</p>
                )}

                <div className="muted">
                  <p>
                    Communication:{" "}
                    {review.communication_rating ??
                      "N/A"}{" "}
                    / 5
                  </p>

                  <p>
                    Professionalism:{" "}
                    {review.professionalism_rating ??
                      "N/A"}{" "}
                    / 5
                  </p>

                  <p>
                    Development:{" "}
                    {review.development_rating ??
                      "N/A"}{" "}
                    / 5
                  </p>

                  <p>
                    Payment:{" "}
                    {review.payment_rating ??
                      "N/A"}{" "}
                    / 5
                  </p>
                </div>

                <p className="muted">
                  Author ID: {review.author_id}
                </p>

                <p className="muted">
                  Submitted:{" "}
                  {new Date(
                    review.created_at
                  ).toLocaleString()}
                </p>

                <div
                  className="actions"
                  style={{
                    marginTop: "20px",
                  }}
                >
                  <button
                    className="btn"
                    disabled={
                      actionLoading === review.id
                    }
                    onClick={() =>
                      updateReviewStatus(
                        review.id,
                        "approved"
                      )
                    }
                  >
                    Approve
                  </button>

                  <button
                    className="btn dark"
                    disabled={
                      actionLoading === review.id
                    }
                    onClick={() =>
                      updateReviewStatus(
                        review.id,
                        "rejected"
                      )
                    }
                  >
                    Reject
                  </button>

                  <button
                    className="btn dark"
                    disabled={
                      actionLoading === review.id
                    }
                    onClick={() =>
                      updateReviewStatus(
                        review.id,
                        "flagged"
                      )
                    }
                  >
                    Flag
                  </button>

                  <button
                    className="btn dark"
                    disabled={
                      actionLoading === review.id
                    }
                    onClick={() =>
                      updateReviewStatus(
                        review.id,
                        "removed"
                      )
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

      <section className="hero">
        <h2>Review Reports</h2>

        {reports.length === 0 ? (
          <div className="card">
            <h2>No reports</h2>

            <p className="muted">
              There are currently no review reports.
            </p>
          </div>
        ) : (
          <div className="grid">
            {reports.map((report) => (
              <div
                className="card"
                key={report.id}
              >
                <h2>
                  Report: {report.status}
                </h2>

                <p>
                  <strong>Reason:</strong>{" "}
                  {report.reason}
                </p>

                <p className="muted">
                  Review ID: {report.review_id}
                </p>

                <p className="muted">
                  Reporter ID:{" "}
                  {report.reporter_id}
                </p>

                <p className="muted">
                  Submitted:{" "}
                  {new Date(
                    report.created_at
                  ).toLocaleString()}
                </p>

                <div className="actions">
                  <button
                    className="btn"
                    disabled={
                      actionLoading === report.id
                    }
                    onClick={() =>
                      updateReportStatus(
                        report.id,
                        "resolved"
                      )
                    }
                  >
                    Resolve
                  </button>

                  <button
                    className="btn dark"
                    disabled={
                      actionLoading === report.id
                    }
                    onClick={() =>
                      updateReportStatus(
                        report.id,
                        "dismissed"
                      )
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
