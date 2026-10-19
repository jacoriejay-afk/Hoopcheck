"use client";

import type { ReactNode, SVGProps } from "react";

export type HoopIconName =
  | "arrow-right"
  | "arrow-up-right"
  | "check"
  | "chevron-right"
  | "search"
  | "user"
  | "users"
  | "shield-check"
  | "edit"
  | "basketball"
  | "whistle"
  | "trophy"
  | "map-pin"
  | "star"
  | "clipboard-check"
  | "message-square"
  | "bell"
  | "calendar"
  | "settings"
  | "lock"
  | "menu"
  | "x"
  | "external-link";

type HoopIconProps = SVGProps<SVGSVGElement> & {
  name: HoopIconName;
  size?: number;
};

const iconPaths: Record<HoopIconName, ReactNode> = {
  "arrow-right": <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  "arrow-up-right": <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.6-3.5 3.1-5.5 7-5.5s6.4 2 7 5.5" /></>,
  users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7.5" r="3.5" /><path d="M17 4.5a3.5 3.5 0 0 1 0 6.8M17 14.5a4.5 4.5 0 0 1 4 4.5V20" /></>,
  "shield-check": <><path d="M12 3 20 6v5.5c0 4.5-3 7.5-8 9.5-5-2-8-5-8-9.5V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
  edit: <><path d="m14 5 5 5" /><path d="M4 20l4.3-.9L19 8.4a2.1 2.1 0 0 0-3-3L5.3 16.1 4 20Z" /></>,
  basketball: <><circle cx="12" cy="12" r="9" /><path d="M3.5 8.5c4.2 0 7.8 3.6 8.5 8.8M8.5 3.5c0 4.2 3.6 7.8 8.8 8.5M20.5 8.5c-4.2 0-7.8 3.6-8.5 8.8M15.5 3.5c0 4.2-3.6 7.8-8.8 8.5" /></>,
  whistle: <><path d="M4 10h8.5a5.5 5.5 0 1 1-5.3 7H4Z" /><path d="M4 10V7h6v3M12.5 10l3-5h4l-2 6" /><circle cx="15.5" cy="14.5" r="1" /></>,
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" /></>,
  "map-pin": <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  "clipboard-check": <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M8.5 13l2.2 2.2 4.8-4.8" /></>,
  "message-square": <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.5-3.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h8M8 14h5" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9L6.1 12l1.4-2.4 1.7.7a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.9Z" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  "external-link": <><path d="M13 5h6v6M19 5l-9 9" /><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
};

export function HoopIcon({ name, size = 20, strokeWidth = 1.8, ...props }: HoopIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}

export type HoopCategory = "teams" | "womens" | "coaches" | "leagues" | "players" | "reviews" | "alerts";

const categoryIcon: Record<HoopCategory, HoopIconName> = {
  teams: "basketball",
  womens: "users",
  coaches: "whistle",
  leagues: "trophy",
  players: "user",
  reviews: "clipboard-check",
  alerts: "shield-check",
};

export function CategoryIconTile({
  category,
  icon,
  label,
  size = "md",
}: {
  category: HoopCategory;
  icon?: HoopIconName;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`hc-category-icon-tile hc-category-icon-tile--${category} hc-category-icon-tile--${size}`} aria-label={label} role={label ? "img" : undefined}>
      <HoopIcon name={icon ?? categoryIcon[category]} size={size === "sm" ? 17 : size === "lg" ? 25 : 21} />
    </span>
  );
}

export function SectionHeader({
  kicker,
  title,
  viewAllHref,
  viewAllLabel = "View all",
}: {
  kicker?: string;
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  const normalizedKicker = kicker?.trim().toLowerCase() === title.trim().toLowerCase() ? undefined : kicker;
  return (
    <div className="hc-section-header">
      <div className="hc-section-header__titles">
        {normalizedKicker ? <p className="hc-kicker">{normalizedKicker}</p> : null}
        <h2>{title}</h2>
      </div>
      {viewAllHref ? (
        <a className="hc-section-header__view-all" href={viewAllHref}>
          {viewAllLabel} <HoopIcon name="arrow-right" size={15} />
        </a>
      ) : null}
    </div>
  );
}

export function HoopButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary"; className?: string }) {
  return (
    <button className={`hc-button hc-button--${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}


export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span className="hc-verified-badge" role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 2.8h8L22 12l-6 9.2H8L2 12Z" fill="currentColor" />
        <path d="m7.8 12.2 2.7 2.7 5.9-6" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
