import Link from "next/link";
import FollowButton from "./FollowButton";
import { HoopIcon } from "./HoopCheckUI";

type TeamDirectoryRowProps = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  leagueName?: string | null;
  href: string;
  kind?: "mens" | "womens";
  showFollow?: boolean;
};

export default function TeamDirectoryRow({
  id, name, city, country, leagueName, href, kind = "mens", showFollow = true,
}: TeamDirectoryRowProps) {
  const monogram = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const metadata = [city, [country, leagueName].filter(Boolean).join(" · ")].filter(Boolean).join(", ") || "International";
  return (
    <article className={`hc-team-directory-row hc-team-directory-row--${kind}`}>
      <Link href={href} className="hc-team-directory-row__main" aria-label={`Open ${name} team profile`}>
        <span className="hc-team-directory-row__monogram" aria-hidden="true">{monogram}</span>
        <span className="hc-team-directory-row__details">
          <strong>{name}</strong>
          <small>{metadata}</small>
        </span>
        <span className="hc-team-directory-row__arrow" aria-hidden="true"><HoopIcon name="arrow-up-right" size={17} /></span>
      </Link>
      {showFollow && <div className="hc-team-directory-row__follow"><FollowButton targetType="team" targetId={id} /></div>}
    </article>
  );
}
