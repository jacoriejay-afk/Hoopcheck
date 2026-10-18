import Link from "next/link";
import HexShield from "./HexShield";

type CategoryRowProps = {
  title: string;
  description: string;
  href: string;
  icon?: "basketball" | "team" | "coach" | "league" | "player" | "review";
  tone?: "orange" | "ink" | "slate" | "white";
  meta?: string;
  className?: string;
};

export default function CategoryRow({
  title,
  description,
  href,
  icon = "basketball",
  tone = "orange",
  meta,
  className = "",
}: CategoryRowProps) {
  return (
    <Link href={href} className={`hc-category-row ${className}`.trim()}>
      <HexShield icon={icon} tone={tone} size="md" />
      <span className="hc-category-row__copy">
        <span className="hc-category-row__title">{title}</span>
        <span className="hc-category-row__description">{description}</span>
        {meta ? <span className="hc-category-row__meta">{meta}</span> : null}
      </span>
      <span className="hc-category-row__action" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
          <path d="M3.5 10h12M10 4.5l5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
