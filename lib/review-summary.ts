export type ReviewSummaryRow = Record<string, unknown>;

const RATING_FIELDS = [
  "overall_rating",
  "communication_rating",
  "professionalism_rating",
  "development_rating",
  "payment_rating",
  "pay_on_time_rating",
  "housing_rating",
  "medical_support_rating",
  "coaching_quality_rating",
  "facilities_rating",
  "playing_time_honesty_rating",
] as const;

function average(rows: ReviewSummaryRow[], field: string): number | null {
  const values = rows
    .map(row => Number(row[field]))
    .filter(value => Number.isFinite(value) && value >= 1 && value <= 5);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100;
}

/** All headline and category ratings derive from the exact same approved rows. */
export function calculateReviewSummary(rows: ReviewSummaryRow[], includeCategories = true) {
  const summary: Record<string, number | null> = {
    overall_rating: average(rows, "overall_rating"),
    review_count: rows.length,
  };
  if (includeCategories) {
    for (const field of RATING_FIELDS.slice(1)) summary[field] = average(rows, field);
  }
  return summary as {
    overall_rating: number | null;
    review_count: number;
    communication_rating?: number | null;
    professionalism_rating?: number | null;
    development_rating?: number | null;
    payment_rating?: number | null;
    pay_on_time_rating?: number | null;
    housing_rating?: number | null;
    medical_support_rating?: number | null;
    coaching_quality_rating?: number | null;
    facilities_rating?: number | null;
    playing_time_honesty_rating?: number | null;
  };
}
