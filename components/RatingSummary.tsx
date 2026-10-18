export interface RatingDistributionItem {
  stars: 1 | 2 | 3 | 4 | 5;
  count?: number;
  percentage: number;
}

export interface RatingSummaryProps {
  score: number;
  totalReviews?: number;
  distribution?: RatingDistributionItem[];
  className?: string;
}

const defaultDistribution: RatingDistributionItem[] = [
  { stars: 5, percentage: 0 },
  { stars: 4, percentage: 0 },
  { stars: 3, percentage: 0 },
  { stars: 2, percentage: 0 },
  { stars: 1, percentage: 0 },
];

function Stars({ score }: { score: number }) {
  return <span className="hc-rating-summary__stars" aria-label={`${score.toFixed(1)} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <span key={star} aria-hidden="true">{score >= star - 0.25 ? "★" : score >= star - 0.75 ? "★" : "☆"}</span>)}</span>;
}

export default function RatingSummary({ score, totalReviews, distribution = defaultDistribution, className = "" }: RatingSummaryProps) {
  const safeScore = Math.min(5, Math.max(0, Number.isFinite(score) ? score : 0));
  return <section className={`hc-rating-summary ${className}`.trim()} aria-label="Rating summary">
    <div className="hc-rating-summary__score">
      <strong>{safeScore.toFixed(1)}</strong>
      <Stars score={safeScore} />
      {typeof totalReviews === "number" && <span className="hc-rating-summary__total">{totalReviews.toLocaleString()} {totalReviews === 1 ? "review" : "reviews"}</span>}
    </div>
    <div className="hc-rating-summary__distribution">
      {[...distribution].sort((a, b) => b.stars - a.stars).map((item) => {
        const percent = Math.min(100, Math.max(0, item.percentage));
        return <div className="hc-rating-summary__bar-row" key={item.stars}>
          <span className="hc-rating-summary__bar-label">{item.stars}★</span>
          <span className="hc-rating-summary__track"><span className="hc-rating-summary__fill" style={{ width: `${percent}%` }} /></span>
          <span className="hc-rating-summary__percent">{percent}%</span>
        </div>;
      })}
    </div>
  </section>;
}
