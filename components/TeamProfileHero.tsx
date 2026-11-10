"use client";

import FollowButton from "./FollowButton";
import TeamLogo from "./TeamLogo";
import { countryFlag } from "../lib/countryFlag";
import TrustScoreDial from "./TrustScoreDial";

type TeamProfileHeroProps = {
  teamId: string;
  name: string;
  country?: string | null;
  city?: string | null;
  leagueName?: string | null;
  logoUrl?: string | null;
  logoBg?: "transparent" | "light" | "dark" | null;
  reviewCount: number;
  followerCount: number;
  trustScore?: {
    score: number | null;
    explanation?: string;
    reviewCount?: number;
    verifiedReviewCount?: number;
  } | null;
  className?: string;
  onFollowerCountChange?: (count: number) => void;
};

export default function TeamProfileHero({
  teamId,
  name,
  country,
  city,
  leagueName,
  logoUrl,
  logoBg,
  reviewCount,
  followerCount,
  trustScore,
  className = "",
  onFollowerCountChange,
}: TeamProfileHeroProps) {
  return (
    <section className={`hero hc-team-profile-hero hc-social-profile-header ${className}`.trim()} id="overview" aria-labelledby="hc-team-profile-title">
      <div className="hc-team-profile-topline">
        <TeamLogo name={name} logoUrl={logoUrl} logoBg={logoBg} size={88} className="hc-team-profile-logo" />
        <FollowButton targetType="team" targetId={teamId} variant="club" showCount={false} showNotifications={false} onCountChange={onFollowerCountChange} />
      </div>
      <p className="hc-team-profile-kicker">HOOPCHECK CLUB PROFILE</p>
      <h1 id="hc-team-profile-title">{name}</h1>
      <p className="hc-team-profile-meta" title={[country, city, leagueName].filter(Boolean).join(" · ")}>
        <span>{countryFlag(country) ? <span className="hc-hero-flag" aria-hidden="true">{countryFlag(country)} </span> : null}{country || "Country not listed"}</span>
        {city ? <span className="hc-team-profile-meta__city"> · {city}</span> : null}
        {leagueName ? <span className="hc-team-profile-meta__league"> · {leagueName}</span> : null}
      </p>
      <div className="hc-team-profile-stats" aria-label="Team profile statistics">
        <div className="hc-team-profile-stat"><strong>{reviewCount}</strong><small>Reviews</small></div>
        <div className="hc-team-profile-stat hc-team-profile-stat--trust">
          {trustScore?.score == null
            ? <strong className="hc-team-profile-stat__missing">—</strong>
            : <span className="hc-team-profile-mini-ring"><TrustScoreDial score={trustScore.score} explanation={trustScore.explanation || "Trust Score"} reviewCount={trustScore.reviewCount ?? reviewCount} verifiedReviewCount={trustScore.verifiedReviewCount ?? 0} /></span>}
          <small>Trust Score</small>
        </div>
        <div className="hc-team-profile-stat"><strong>{followerCount}</strong><small>Followers</small></div>
      </div>
    </section>
  );
}
