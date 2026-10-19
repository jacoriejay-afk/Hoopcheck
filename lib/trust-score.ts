export type TrustScoreReview = {
  createdAt: string;
  reviewerVerified: boolean;
};

export type TrustScoreInput = {
  averageRating: number | null;
  reviews: TrustScoreReview[];
  /** Optional stable clock for tests and server rendering. */
  now?: Date;
};

export type TrustScoreResult = {
  score: number | null;
  reviewCount: number;
  verifiedReviewCount: number;
  verifiedPercentage: number | null;
  ratingQuality: number | null;
  reviewConfidence: number;
  recency: number | null;
  explanation: string;
};

/**
 * HoopCheck Trust Score v1 (0–100):
 * 50% normalized average rating + 20% review-volume confidence
 * + 20% verified-review share + 10% review recency.
 *
 * Rating: 1 star => 0, 5 stars => 100.
 * Volume confidence: min(approved reviews / 30, 1) * 100.
 * Verification: verified reviewers / all included reviews * 100.
 * Recency: mean exponential decay of each review's age, using a 180-day half-life.
 * No reviews or no usable rating => no score, not a misleading zero.
 */
export function calculateTrustScore({
  averageRating,
  reviews,
  now = new Date(),
}: TrustScoreInput): TrustScoreResult {
  const reviewCount = reviews.length;
  const verifiedReviewCount = reviews.filter((review) => review.reviewerVerified).length;
  const verifiedPercentage = reviewCount
    ? (verifiedReviewCount / reviewCount) * 100
    : null;
  const ratingQuality =
    typeof averageRating === "number" && Number.isFinite(averageRating)
      ? (Math.max(1, Math.min(5, averageRating)) - 1) * 25
      : null;
  const reviewConfidence = Math.min(reviewCount / 30, 1) * 100;

  const validAges = reviews
    .map((review) => Date.parse(review.createdAt))
    .filter((timestamp) => Number.isFinite(timestamp))
    .map((timestamp) => Math.max(0, now.getTime() - timestamp) / 86_400_000);
  const recency = validAges.length
    ? validAges.reduce((sum, ageDays) => sum + 100 * Math.pow(0.5, ageDays / 180), 0) /
      validAges.length
    : null;

  const score =
    reviewCount > 0 && ratingQuality !== null && verifiedPercentage !== null && recency !== null
      ? Math.round(
          ratingQuality * 0.5 +
          reviewConfidence * 0.2 +
          verifiedPercentage * 0.2 +
          recency * 0.1
        )
      : null;

  return {
    score,
    reviewCount,
    verifiedReviewCount,
    verifiedPercentage,
    ratingQuality,
    reviewConfidence,
    recency,
    explanation: reviewCount
      ? `Based on ${verifiedReviewCount} verified player review${verifiedReviewCount === 1 ? "" : "s"} out of ${reviewCount} total.`
      : "Not enough player reviews to calculate a Trust Score yet.",
  };
}
