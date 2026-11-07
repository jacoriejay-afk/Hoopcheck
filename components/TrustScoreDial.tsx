"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./LanguageProvider";

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
  const { t } = useLanguage();
  const mini = size === "mini";
  const dimension = mini ? 58 : 92;
  const stroke = mini ? 5 : 7;
  const radius = (dimension - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = score === null ? 0 : Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - safeScore / 100);
  const [animated, setAnimated] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setAnimated(false);
    if (score === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(min-width: 1024px)").matches) { setAnimated(true); return; }
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") { setAnimated(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setAnimated(true); observer.disconnect(); } }, { threshold: .25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [score, size, safeScore, reviewCount]);

  return (
    <div ref={rootRef} className={`hc-trust-score hc-trust-score--${size}`}>
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
            strokeDashoffset={animated ? offset : circumference}
            transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
          />}
        </svg>
        <strong aria-label={score === null ? t("trustScoreUnavailable") : t("scoreOutOf100").replace("{score}",String(score))}>{score === null ? "—" : score}</strong>
      </div>
      <div className="hc-trust-score__copy">
        <span>HoopCheck {t("trustScore")}</span>
        {!mini && <small>{explanation}</small>}
        {mini && <small>{score === null ? t("memberInsight") : `${verifiedReviewCount} ${t("verified")} · ${reviewCount} ${t("reviews")}`}</small>}
        {!mini && <><button type="button" className="hc-trust-details-toggle" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}>{detailsOpen ? "Hide score context" : "About this score"}</button>{detailsOpen && <small className="hc-trust-details">{reviewCount} published reviews · {verifiedReviewCount} verified. Scores are review-based and should be considered alongside review details and sample size.</small>}</>}
      </div>
    </div>
  );
}
