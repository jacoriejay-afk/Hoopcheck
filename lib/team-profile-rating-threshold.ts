export type RatedCategory = { count: number; average: number | null; percentage: number | null };
/**
 * PAYIDX-1 privacy threshold: do not publish an aggregate percentage
 * unless at least five approved reviews rated this specific category.
 */
export function summarizeRatedCategory<T>(
  reviews: readonly T[],
  rating: (review: T) => number | null | undefined,
  minimum = 5,
): RatedCategory {
  const values = reviews.map(rating).filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 5
  );
  const count = values.length;
  if (count < minimum) return { count, average: null, percentage: null };
  const average = values.reduce((sum, value) => sum + value, 0) / count;
  return { count, average, percentage: Math.round((average / 5) * 100) };
}
