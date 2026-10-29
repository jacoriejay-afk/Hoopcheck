import Link from "next/link";
import FollowButton from "./FollowButton";
import { HoopIcon } from "./HoopCheckUI";
import Surface from "./Surface";
import TeamLogo from "./TeamLogo";
import { useLanguage } from "./LanguageProvider";

type TeamDirectoryRowProps = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  leagueName?: string | null;
  href: string;
  kind?: "mens" | "womens";
  showFollow?: boolean;
  trustScore?: number | null;
  trustReviewCount?: number;
  trustVerifiedReviewCount?: number;
  trustExplanation?: string;
  averageRating?: number | null;
  logoUrl?: string | null;
  logoBg?: "transparent" | "light" | "dark" | null;
  trustTier?: "free" | "pro" | "premium" | "player" | "member" | "unknown";
};

export default function TeamDirectoryRow({
  id, name, city, country, leagueName, href, kind = "mens", showFollow = true,
  trustReviewCount = 0, averageRating = null, logoUrl = null, logoBg = "transparent", trustTier = "unknown",
}: TeamDirectoryRowProps) {
  const { t } = useLanguage();
  const metadata = [city, country, leagueName].filter(Boolean).join(", ") || t("international");
  const hasReviews = trustReviewCount > 0;
  const hasRating = averageRating !== null && averageRating !== undefined;
  return (
    <Surface className={"hc-team-directory-row hc-scout-card hc-team-directory-row--" + kind}>
      <Link href={href} className="hc-team-directory-row__main" aria-label={t("openTeamProfile") + ": " + name}>
        <span className="hc-scout-card__identity">
          <TeamLogo name={name} logoUrl={logoUrl} logoBg={logoBg} size={48} />
          <span className="hc-scout-card__identity-copy">
            <h2 title={name}>{name}</h2>
            <p title={metadata}>{metadata}</p>
          </span>
          <span className="hc-team-directory-row__arrow" aria-hidden="true"><HoopIcon name="chevron-right" size={18} /></span>
        </span>
      </Link>
      <div className="hc-scout-card__stats" aria-label={t("teamReviewStatistics")}>
        {trustTier === "free" ? <div className="hc-directory-locked"><strong>🔒 Player reviews are a Premium fan feature</strong><Link href="/membership" className="btn">Upgrade</Link></div>
        : trustTier === "pro" ? <div className="hc-directory-locked"><strong>Trust Score</strong><small>Fan Premium feature</small><Link href="/membership" className="btn">Upgrade</Link></div>
        : (!hasRating && !hasReviews) ? <p className="hc-scout-card__empty">{t("teamDirectoryEmptyReviews")}</p>
        : <><div className="hc-scout-card__stat"><strong>{hasRating ? <><span className="hc-scout-card__star" aria-hidden="true">★</span> {averageRating.toFixed(1)}</> : "—"}</strong><small>{t("ratingLabel")}</small></div><div className="hc-scout-card__stat"><strong>{trustReviewCount}</strong><small>{trustReviewCount === 1 ? t("reviewSingular") : t("reviewPlural")}</small></div><div className="hc-scout-card__stat"><strong>—</strong><small>{t("seasonsLabel")}</small></div></>}
      </div>
      <footer className="hc-scout-card__ticket">
        <Link href={href} className="hc-scout-card__report-link">{t("openScoutingReport")} <span aria-hidden="true">→</span></Link>
        {showFollow && <div className="hc-team-directory-row__follow"><FollowButton targetType="team" targetId={id} /></div>}
      </footer>
    </Surface>
  );
}
