import { countryFlag } from "../lib/countryFlag";
import { getCachedSession } from "../lib/supabase";
import { useEffect, useState } from "react";
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
  trustScore?: number | null;
  trustReviewCount?: number | null;
  trustExplanation?: string;
  logoUrl?: string | null;
  logoBg?: "transparent" | "light" | "dark" | null;
  trustTier?: "free" | "pro" | "premium" | "player" | "member" | "unknown";
  viewerRole?: string;
};

export default function TeamDirectoryRow({
  id, name, city, country, leagueName, href, kind = "mens",
  trustScore, trustReviewCount, trustExplanation, logoUrl, logoBg, trustTier = "unknown", viewerRole,
}: TeamDirectoryRowProps) {
  const { t } = useLanguage();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    if (trustTier !== "free" || viewerRole) return;
    let active = true;
    void getCachedSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    }).catch(() => { if (active) setSignedIn(false); });
    return () => { active = false; };
  }, [trustTier, viewerRole]);

  const flag = countryFlag(country);
  const score = typeof trustScore === "number" && Number.isFinite(trustScore) ? Math.round(trustScore) : null;
  const locked = trustTier === "free" || trustTier === "pro";
  const showStats = score !== null || trustReviewCount != null;

  return (
    <Surface className={"hc-team-directory-row hc-directory-compact-row hc-team-directory-row--" + kind}>
      <Link href={href} className="hc-directory-compact-link" aria-label={t("openTeamProfile") + ": " + name}>
        <TeamLogo name={name} logoUrl={logoUrl} logoBg={logoBg} size={44} />
        <span className="hc-directory-compact-copy">
          <strong>{name}</strong>
          {(city || country) && <small>{flag && <span aria-hidden="true">{flag} </span>}{[city, country].filter(Boolean).join(", ")}</small>}
          {leagueName && <small>{leagueName}</small>}
        </span>
        <HoopIcon name="chevron-right" size={16} />
      </Link>
      <div className="hc-directory-compact-meta">
        {locked && (viewerRole || signedIn !== null) && (
          <Link href={viewerRole || signedIn ? "/membership" : "/login"} className="hc-directory-access">
            <HoopIcon name="lock" size={14} />
            {viewerRole === "fan" || trustTier === "pro" ? "Fan Premium for Trust Score"
              : viewerRole || signedIn ? "Membership for Trust Score" : "Sign in for Trust Score"}
          </Link>
        )}
        {!locked && showStats && <div className="hc-directory-compact-stats" aria-label={t("teamReviewStatistics")}>
          {score !== null && <span title={trustExplanation}>Trust Score <strong>{score}</strong></span>}
          {trustReviewCount != null && <span>{trustReviewCount} {trustReviewCount === 1 ? t("reviewSingular") : t("reviewPlural")}</span>}
        </div>}
        <FollowButton targetType="team" targetId={id} showNotifications={false} compact />
      </div>
    </Surface>
  );
}
