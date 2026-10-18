export type RatingDistribution = {
  stars: 1 | 2 | 3 | 4 | 5;
  count: number;
};

type RatingBreakdownProps = {
  rating: number;
  reviewCount: number;
  distribution: RatingDistribution[];
  label?: string;
  className?: string;
};

function RatingStar({ filled = true }: { filled?: boolean }) {
  return (
    <svg className={filled ? "hc-rating-star is-filled" : "hc-rating-star"} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2.8 2.8 5.7 6.3.9-4.55 4.45 1.08 6.28L12 17.15l-5.63 2.98 1.08-6.28L2.9 9.4l6.3-.9Z" />
    </svg>
  );
}

export default function RatingBreakdown({
  rating,
  reviewCount,
  distribution,
  label = "Player rating",
  className = "",
}: RatingBreakdownProps) {
  const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  const total = Math.max(0, distribution.reduce((sum, item) => sum + Math.max(0, item.count), 0));

  return (
    <section className={`hc-rating-card ${className}`.trim()} aria-label={label}>
      <div className="hc-rating-card__summary">
        <div className="hc-rating-card__score">{safeRating.toFixed(1)}</div>
        <div className="hc-rating-card__details">
          <div className="hc-rating-card__stars" aria-label={`${safeRating.toFixed(1)} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, index) => <RatingStar key={index} filled={index < Math.round(safeRating)} />)}
          </div>
          <div className="hc-rating-card__count">{reviewCount.toLocaleString()} {reviewCount === 1 ? "review" : "reviews"}</div>
        </div>
      </div>
      <div className="hc-rating-card__distribution">
        {[...distribution].sort((a, b) => b.stars - a.stars).map((item) => {
          const percentage = total === 0 ? 0 : Math.round((Math.max(0, item.count) / total) * 100);
          return (
            <div className="hc-rating-bar-row" key={item.stars}>
              <span className="hc-rating-bar-row__label">{item.stars}</span>
              <span className="hc-rating-bar-row__star" aria-hidden="true"><RatingStar /></span>
              <span className="hc-rating-bar"><span style={{ width: `${percentage}%` }} /></span>
              <span className="hc-rating-bar-row__count">{item.count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
