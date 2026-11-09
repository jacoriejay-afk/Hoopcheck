import { countryFlag } from "../lib/countryFlag";
import Link from "next/link";
import FollowButton from "./FollowButton";
import { HoopIcon } from "./HoopCheckUI";
import Surface from "./Surface";
import TeamLogo from "./TeamLogo";
import TrustScoreDial from "./TrustScoreDial";
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
  trustReviewCount?: number | null;
  trustVerifiedReviewCount?: number;
  followerCount?: number | null;
  trustExplanation?: string;
  averageRating?: number | null;
  logoUrl?: string | null;
  logoBg?: "transparent" | "light" | "dark" | null;
  trustTier?: "free" | "pro" | "premium" | "player" | "member" | "unknown";
  fanView?: boolean;
};

export default function TeamDirectoryRow({
  id, name, city, country, leagueName, href, kind = "mens", showFollow = true,
  trustScore = null, trustReviewCount = null, trustVerifiedReviewCount = 0, followerCount = null, trustExplanation = "", logoUrl = null, logoBg = "transparent", trustTier = "unknown", fanView = false,
}: TeamDirectoryRowProps) {
  const { t } = useLanguage();
  const flag = countryFlag(country);
  const hasTrustScore = typeof trustScore === "number" && Number.isFinite(trustScore);
  return (
    <Surface className={"hc-team-directory-row hc-scout-card hc-smooth-card hc-dossier-card hc-team-directory-row--" + kind}>
      <Link href={href} className="hc-team-directory-row__main" aria-label={t("openTeamProfile") + ": " + name}>
        <span className="hc-scout-card__identity">
          <TeamLogo name={name} logoUrl={logoUrl} logoBg={logoBg} size={48} />
          <span className="hc-scout-card__identity-copy">
            <h2 title={name}>{name}</h2>
            <p>{flag && <span aria-label={`${country} flag`} role="img">{flag} </span>}{country || "Country not listed"}{city ? ` · ${city}` : ""}</p><span className="hc-scout-card__details"><small>{leagueName || "League not listed"}</small><small>{kind === "womens" ? "Women" : "Men"}</small></span>
          </span>
          <span className="hc-team-directory-row__arrow" aria-hidden="true"><HoopIcon name="chevron-right" size={18} /></span>
        </span>
      </Link>
      <div className="hc-scout-card__stats" aria-label={t("teamReviewStatistics")}>
        {trustTier === "free" ? <div className="hc-directory-locked"><small>{fanView ? "Fan Premium unlocks full reviews" : "Membership unlocks full player reviews"}</small><Link href="/membership" className="btn">{fanView ? "Fan Premium" : "Plans"}</Link></div>
        : trustTier === "pro" ? <div className="hc-directory-locked"><small>Fan Premium unlocks Trust Score details</small><Link href="/membership" className="btn">View Fan Premium</Link></div>
        : <><div className="hc-d3-mobile-trust"><div className="hc-scout-card__stat"><strong>{hasTrustScore ? Math.round(trustScore) : "—"}</strong><small>Trust Score</small></div><div className="hc-scout-card__stat"><strong>{trustReviewCount == null ? "—" : trustReviewCount}</strong><small>{trustReviewCount === 1 ? t("reviewSingular") : t("reviewPlural")}</small></div></div><div className="hc-d3-desktop-trust"><TrustScoreDial score={hasTrustScore ? trustScore : null} explanation={trustExplanation || (fanView ? "Not enough team reviews to calculate a Trust Score yet." : "Not enough player reviews to calculate a Trust Score yet.")} reviewCount={trustReviewCount ?? 0} verifiedReviewCount={trustVerifiedReviewCount} size="mini"/><div className="hc-scout-card__stat"><strong>{trustReviewCount == null ? "—" : trustReviewCount}</strong><small>{trustReviewCount === 1 ? t("reviewSingular") : t("reviewPlural")}</small></div><div className="hc-scout-card__stat"><strong>{followerCount == null ? "—" : followerCount}</strong><small>FOLLOWERS</small></div></div></>}
      </div>
      <footer className="hc-scout-card__ticket">
        <Link href={href} className="hc-scout-card__report-link">{t("openTeamProfile")} <span aria-hidden="true">→</span></Link>
        {showFollow && <div className="hc-team-directory-row__follow"><FollowButton targetType="team" targetId={id} /></div>}
      </footer>
    </Surface>
  );
}
