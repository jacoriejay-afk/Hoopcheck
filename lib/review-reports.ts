import { supabase } from "./supabase";

type ReportSubmissionResult =
  | { success: true }
  | {
      success: false;
      message: string;
    };

export async function submitReviewReport(
  reviewId: string,
  reason: string
): Promise<ReportSubmissionResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Unable to read report submitter session:", sessionError);
    return {
      success: false,
      message: "Could not verify your session. Please try again.",
    };
  }

  if (!session?.access_token) {
    return {
      success: false,
      message: "Please log in to report a review.",
    };
  }

  try {
    const response = await fetch("/api/review-reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reviewId, reason }),
    });
    const result: { error?: string } = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message:
          result.error || "Could not submit your report. Please try again.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Review report request failed:", error);
    return {
      success: false,
      message: "Could not submit your report. Please try again.",
    };
  }
}
