import { countryFlag } from "../lib/countryFlag";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
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
  fanView?: boolean;
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
  viewerRole?: string;
};

export default function TeamDirectoryRow({
  id, name, city, country, leagueName, href, kind = "mens", showFollow = true, fanView = false,
  trustScore = null, trustReviewCount = null, trustVerifiedReviewCount = 0, followerCount = null, trustExplanation = "", logoUrl = null, logoBg = "transparent", trustTier = "unknown", viewerRole = "",
}: TeamDirectoryRowProps) {
  const { t } = useLanguage();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { let on = true; supabase.auth.getSession().then(({ data }) => { if (on) setSignedIn(Boolean(data.session)); }).catch(() => { if (on) setSignedIn(false); }); return () => { on = false; }; }, []);
  const resolvedViewerRole = fanView ? "fan" : viewerRole;
  const showSignIn = !resolvedViewerRole && signedIn === false;
  const lockedTitle = resolvedViewerRole === "fan" ? "Fan Premium unlocks full reviews and Trust Score; Fan Pro shows rating previews" : resolvedViewerRole === "player" ? "Player Pro or Premium membership unlocks full review details" : resolvedViewerRole || signedIn ? "An active membership is required to view Trust Score details" : showSignIn ? "Sign in to view Trust Score details" : "Trust Score";
  const hasTrustScore = typeof trustScore === "number" && Number.isFinite(trustScore);
  const flag = countryFlag(country);
  return (
    <Surface className={"hc-team-directory-row hc-scout-card hc-smooth-card hc-team-directory-row--" + kind}>
      <Link href={href} className="hc-team-directory-row__main" aria-label={t("openTeamProfile") + ": " + name}>
        <span className="hc-scout-card__identity"><span className="hc-dossier-card__kicker">CLUB DOSSIER · {kind === "womens" ? "WOMEN" : "MEN"}</span>
          <span className="hc-dir-crest"><TeamLogo name={name} logoUrl={logoUrl} logoBg={logoBg} size={64} /></span>
          <span className="hc-scout-card__identity-copy">
            <h2 title={name}>{name}</h2>
            <p>{city || "City not listed"}</p><span className="hc-scout-card__details"><small>{leagueName || "League not listed"}</small></span>
            {country ? <span className="hc-dir-flagchip">{flag ? <span className="hc-dir-flag" aria-hidden="true">{flag}</span> : null}<span>{country}</span></span> : null}
          </span>
          <span className="hc-team-directory-row__arrow" aria-hidden="true"><HoopIcon name="chevron-right" size={18} /></span>
        </span>
      </Link>
      <div className="hc-scout-card__stats" aria-label={t("teamReviewStatistics")}>
        {trustTier === "free" ? <div className="hc-directory-locked"><strong>{lockedTitle}</strong>{showSignIn ? <Link href="/login" className="btn">Sign In</Link> : resolvedViewerRole || signedIn ? <Link href="/membership" className="btn">{resolvedViewerRole === "fan" ? "View Fan Premium" : "View Membership"}</Link> : <small>Checking your access…</small>}</div>
        : trustTier === "pro" ? <div className="hc-directory-locked"><strong>Trust Score</strong><small>Full Trust Score details require Fan Premium</small><Link href="/membership" className="btn">Upgrade to Fan Premium</Link></div>
        : <><div className="hc-d3-mobile-trust"><div className="hc-scout-card__stat"><strong>{hasTrustScore ? Math.round(trustScore) : "—"}</strong><small>Trust Score</small></div><div className="hc-scout-card__stat"><strong>{trustReviewCount == null ? "—" : trustReviewCount}</strong><small>{trustReviewCount === 1 ? t("reviewSingular") : t("reviewPlural")}</small></div></div><div className="hc-d3-desktop-trust"><TrustScoreDial score={hasTrustScore ? trustScore : null} explanation={trustExplanation || "Not enough player reviews to calculate a Trust Score yet."} reviewCount={trustReviewCount ?? 0} verifiedReviewCount={trustVerifiedReviewCount} size="mini"/><div className="hc-scout-card__stat"><strong>{trustReviewCount == null ? "—" : trustReviewCount}</strong><small>{trustReviewCount === 1 ? t("reviewSingular") : t("reviewPlural")}</small></div><div className="hc-scout-card__stat"><strong>{followerCount == null ? "—" : followerCount}</strong><small>FOLLOWERS</small></div></div></>}
      </div>
      <footer className="hc-scout-card__ticket">
        <Link href={href} className="hc-scout-card__report-link">{t("openTeamProfile")} <span aria-hidden="true">→</span></Link>
        {showFollow && <div className="hc-team-directory-row__follow"><FollowButton targetType="team" targetId={id} /></div>}
      </footer>
    </Surface>
  );
}
