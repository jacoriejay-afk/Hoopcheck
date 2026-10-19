"use client";

type TrustScoreDialProps = {
  score: number | null;
  explanation: string;
  reviewCount: number;
  verifiedReviewCount: number;
  size?: "full" | "mini";
};

export default function TrustScoreDial({
  score,
  explanation,
  reviewCount,
  verifiedReviewCount,
  size = "full",
}: TrustScoreDialProps) {
  const mini = size === "mini";
  const dimension = mini ? 58 : 92;
  const stroke = mini ? 5 : 7;
  const radius = (dimension - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = score === null ? 0 : Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - safeScore / 100);

  return (
    <div className={`hc-trust-score hc-trust-score--${size}`}>
      <div className="hc-trust-score__dial" style={{ width: dimension, height: dimension }}>
        <svg viewBox={`0 0 ${dimension} ${dimension}`} width={dimension} height={dimension} aria-hidden="true">
          <circle cx={dimension / 2} cy={dimension / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth={stroke} />
          {score !== null && <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="#FF5A1F"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
          />}
        </svg>
        <strong aria-label={score === null ? "Trust Score unavailable" : `Trust Score ${score} out of 100`}>{score === null ? "—" : score}</strong>
      </div>
      <div className="hc-trust-score__copy">
        <span>HoopCheck Trust Score</span>
        {!mini && <small>{explanation}</small>}
        {mini && <small>{score === null ? "Member insight" : `${verifiedReviewCount} verified · ${reviewCount} reviews`}</small>}
      </div>
    </div>
  );
}
