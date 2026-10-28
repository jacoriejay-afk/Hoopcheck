"use client";

import { useEffect, useRef, useState } from "react";
import { MotionNumber } from "./HoopMotion";
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
  const dialRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  useEffect(() => {
    const node = dialRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setRevealed(true); observer.disconnect(); } }, { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const bandColor = score === null ? "currentColor" : animatedScore < 40 ? "#E5484D" : animatedScore < 70 ? "#FF8A24" : "#1E9E50";

  return (
    <div className={`hc-trust-score hc-trust-score--${size}`}>
      <div ref={dialRef} className="hc-trust-score__dial" style={{ width: dimension, height: dimension }}>
        <svg viewBox={`0 0 ${dimension} ${dimension}`} width={dimension} height={dimension} aria-hidden="true">
          <circle cx={dimension / 2} cy={dimension / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth={stroke} />
          {score !== null && <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke={bandColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={revealed ? offset : circumference}
            transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
          />}
        </svg>
        <strong aria-label={score === null ? t("trustScoreUnavailable") : t("scoreOutOf100").replace("{score}",String(score))}>{score === null ? "—" : <MotionNumber value={safeScore} duration={900} onValueChange={setAnimatedScore} />}</strong>
      </div>
      <div className="hc-trust-score__copy">
        <span>HoopCheck {t("trustScore")}</span>
        {!mini && <small>{explanation}</small>}
        {mini && <small>{score === null ? t("memberInsight") : `${verifiedReviewCount} ${t("verified")} · ${reviewCount} ${t("reviews")}`}</small>}
      </div>
    </div>
  );
}
