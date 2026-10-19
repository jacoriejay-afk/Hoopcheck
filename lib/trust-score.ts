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
 * HoopCheck Trust Score v1 (0–100), all terms normalized to 0–100:
 * 40% rating + 20% review-volume confidence + 20% verified-review share
 * + 20% recency.
 *
 * R = (average rating / 5) * 100.
 * N = (1 - exp(-approved review count / 10)) * 100.
 * V = verified reviewers / all included reviewers * 100.
 * F = mean exponential freshness, with a 30-day half-life:
 *     mean(100 * 0.5^(review age in days / 30)).
 * Score = round(0.40R + 0.20N + 0.20V + 0.20F).
 *
 * Only approved reviews should be passed in. Invalid timestamps are ignored for
 * freshness; an absent usable rating or no reviews means no score, not zero.
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
      ? Math.max(0, Math.min(100, (Math.max(1, Math.min(5, averageRating)) / 5) * 100))
      : null;
  const reviewConfidence = (1 - Math.exp(-reviewCount / 10)) * 100;

  const validAges = reviews
    .map((review) => Date.parse(review.createdAt))
    .filter((timestamp) => Number.isFinite(timestamp))
    .map((timestamp) => Math.max(0, now.getTime() - timestamp) / 86_400_000);
  const recency = validAges.length
    ? validAges.reduce((sum, ageDays) => sum + 100 * Math.pow(0.5, ageDays / 30), 0) /
      validAges.length
    : null;

  const score =
    reviewCount > 0 && ratingQuality !== null && verifiedPercentage !== null && recency !== null
      ? Math.max(0, Math.min(100, Math.round(
          ratingQuality * 0.4 +
          reviewConfidence * 0.2 +
          verifiedPercentage * 0.2 +
          recency * 0.2
        )))
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
