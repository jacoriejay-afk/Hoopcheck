import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export type CategoryTileKind = "teams" | "womens" | "coaches" | "leagues" | "players" | "reviews" | "alerts";

const categoryColors: Record<CategoryTileKind, string> = {
  teams: "var(--hc-category-teams)",
  womens: "var(--hc-category-womens)",
  coaches: "var(--hc-category-coaches)",
  leagues: "var(--hc-category-leagues)",
  players: "var(--hc-category-players)",
  reviews: "var(--hc-category-reviews)",
  alerts: "var(--hc-category-alerts)",
};

function CategoryIcon({ kind }: { kind: CategoryTileKind }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...common}>
    {kind === "teams" && <><path d="M16 3 27 9v14l-11 6L5 23V9Z"/><circle cx="16" cy="16" r="7"/><path d="M9 16h14M16 9c-3 3-3 11 0 14M16 9c3 3 3 11 0 14"/></>}
    {kind === "womens" && <><circle cx="16" cy="10" r="5"/><path d="M16 15v12m-5-5h10"/></>}
    {kind === "coaches" && <><circle cx="16" cy="9" r="5"/><path d="M6 28c.5-6 4-9 10-9s9.5 3 10 9M23 5l4 4-4 4"/></>}
    {kind === "leagues" && <><circle cx="16" cy="16" r="12"/><path d="M4 16h24M16 4c-5 5-5 19 0 24M16 4c5 5 5 19 0 24M7 8h18M7 24h18"/></>}
    {kind === "players" && <><circle cx="12" cy="9" r="4"/><path d="M3 27c.5-5 3.5-8 9-8 2 0 3.5.5 5 1.5"/><circle cx="22" cy="21" r="5"/><path d="m19 21 2 2 4-4"/></>}
    {kind === "reviews" && <><path d="m16 3 4 8 9 1-6.5 6 2 9L16 22l-8.5 5 2-9L3 12l9-1Z"/></>}
    {kind === "alerts" && <><path d="M25 22H7c2-2 3-4 3-9a6 6 0 0 1 12 0c0 5 1 7 3 9Z"/><path d="M13 26h6"/></>}
  </svg>;
}

export interface CategoryTileProps {
  label: string;
  category: CategoryTileKind;
  href?: string;
  description?: string;
  className?: string;
  icon?: ReactNode;
}

export default function CategoryTile({ label, category, href, description, className = "", icon }: CategoryTileProps) {
  const style = { "--category-color": categoryColors[category] } as CSSProperties;
  const content = <>
    <span className="hc-category-tile__hex"><span className="hc-category-tile__icon">{icon ?? <CategoryIcon kind={category} />}</span></span>
    <span className="hc-category-tile__label">{label}</span>
    {description && <span className="hc-category-tile__description">{description}</span>}
    <span className="hc-category-tile__arrow" aria-hidden="true">↗</span>
  </>;
  return href
    ? <Link className={`hc-category-tile ${className}`.trim()} style={style} href={href}>{content}</Link>
    : <div className={`hc-category-tile ${className}`.trim()} style={style}>{content}</div>;
}
