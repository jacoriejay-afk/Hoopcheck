"use client";

import { useLanguage } from "./LanguageProvider";
import TrustScoreRing from "./TrustScoreRing";

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

  return (
    <div className={`hc-trust-score hc-trust-score--${size}`}>
      <TrustScoreRing score={score} dimension={dimension} stroke={stroke} />
      <div className="hc-trust-score__copy">
        <span>HoopCheck {t("trustScore")}</span>
        {!mini && <small>{explanation}</small>}
        {mini && <small>{score === null ? t("memberInsight") : `${verifiedReviewCount} ${t("verified")} · ${reviewCount} ${t("reviews")}`}</small>}
      </div>
    </div>
  );
}
