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
  trustScore = null, trustReviewCount = 0, logoUrl = null, logoBg = "transparent", trustTier = "unknown",
}: TeamDirectoryRowProps) {
  const { t } = useLanguage();
  const hasTrustScore = typeof trustScore === "number" && Number.isFinite(trustScore);
  return (
    <Surface className={"hc-team-directory-row hc-scout-card hc-team-directory-row--" + kind}>
      <Link href={href} className="hc-team-directory-row__main" aria-label={t("openTeamProfile") + ": " + name}>
        <span className="hc-scout-card__identity">
          <TeamLogo name={name} logoUrl={logoUrl} logoBg={logoBg} size={48} />
          <span className="hc-scout-card__identity-copy">
            <h2 title={name}>{name}</h2>
            <p>{city || "City not listed"}</p><span className="hc-scout-card__details"><small>{leagueName || "League not listed"}</small><small>{country || "Country not listed"}</small></span>
          </span>
          <span className="hc-team-directory-row__arrow" aria-hidden="true"><HoopIcon name="chevron-right" size={18} /></span>
        </span>
      </Link>
      <div className="hc-scout-card__stats" aria-label={t("teamReviewStatistics")}>
        {trustTier === "free" ? <div className="hc-directory-locked"><strong>Full player reviews require an eligible membership</strong><Link href="/membership" className="btn">Upgrade</Link></div>
        : trustTier === "pro" ? <div className="hc-directory-locked"><strong>Trust Score</strong><small>Full Trust Score details require Fan Premium</small><Link href="/membership" className="btn">Upgrade</Link></div>
        : <><div className="hc-scout-card__stat"><strong>{hasTrustScore ? Math.round(trustScore) : "—"}</strong><small>Trust Score</small></div><div className="hc-scout-card__stat"><strong>{trustReviewCount}</strong><small>{trustReviewCount === 1 ? t("reviewSingular") : t("reviewPlural")}</small></div></>
      </div>
      <footer className="hc-scout-card__ticket">
        <Link href={href} className="hc-scout-card__report-link">{t("openScoutingReport")} <span aria-hidden="true">→</span></Link>
        {showFollow && <div className="hc-team-directory-row__follow"><FollowButton targetType="team" targetId={id} /></div>}
      </footer>
    </Surface>
  );
}
