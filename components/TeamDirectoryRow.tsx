import Link from "next/link";
import FollowButton from "./FollowButton";
import { HoopIcon } from "./HoopCheckUI";
import Surface from "./Surface";

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
};

export default function TeamDirectoryRow({
  id, name, city, country, leagueName, href, kind = "mens", showFollow = true,
  trustScore, trustReviewCount = 0, trustVerifiedReviewCount = 0, trustExplanation = "Trust Score unavailable", averageRating = null, logoUrl = null,
}: TeamDirectoryRowProps) {
  const monogram = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const metadata = [city, [country, leagueName].filter(Boolean).join(" · ")].filter(Boolean).join(", ") || "International";
  return (
    <Surface className={`hc-team-directory-row hc-scout-card hc-team-directory-row--${kind}`}>
      <div className="hc-scout-card__report">
        <span>HoopCheck Scouting Report</span>
        <span>Directory profile</span>
      </div>
      <Link href={href} className="hc-team-directory-row__main" aria-label={`Open ${name} team profile`}>
        <span className="hc-scout-card__identity">
          <span className="hc-scout-card__jersey hc-team-logo-tile" aria-hidden="true">{logoUrl ? <img src={logoUrl} alt="" width={48} height={48} loading="lazy" /> : monogram}</span>
          <span className="hc-scout-card__identity-copy">
            <h2>{name}</h2>
            <p>{metadata}</p>
          </span>
          <span className="hc-team-directory-row__arrow" aria-hidden="true"><HoopIcon name="arrow-up-right" size={17} /></span>
        </span>
      </Link>
      {trustScore !== undefined && <div className="hc-team-directory-row__trust">
        <TrustScoreDial score={trustScore} explanation={trustExplanation} reviewCount={trustReviewCount} verifiedReviewCount={trustVerifiedReviewCount} size="mini" />
      </div>}
      <div className="hc-scout-card__stats" aria-label="Team review statistics">
        <div className="hc-scout-card__stat"><span>Overall rating</span><strong>{averageRating === null || averageRating === undefined ? "—" : averageRating.toFixed(1)}</strong><small>{averageRating == null ? "Not available" : "Out of 5"}</small></div>
        <div className="hc-scout-card__stat"><span>Reviews</span><strong>{trustReviewCount}</strong><small>{trustReviewCount === 1 ? "Approved review" : "Approved reviews"}</small></div>
        <div className="hc-scout-card__stat"><span>Seasons tracked</span><strong>—</strong><small>Not listed</small></div>
      </div>
      <div className="hc-scout-card__ticket">
        <Link href={href}>Open scouting report <span aria-hidden="true">→</span></Link>
        {showFollow && <div className="hc-team-directory-row__follow"><FollowButton targetType="team" targetId={id} /></div>}
      </div>
    </Surface>
  );
}
