import type { ReactNode, SVGProps } from "react";

type ShieldIconName = "basketball" | "team" | "coach" | "league" | "player" | "review";

type HexShieldProps = {
  icon?: ShieldIconName;
  tone?: "orange" | "ink" | "slate" | "white";
  size?: "sm" | "md" | "lg";
  className?: string;
};

function ShieldGlyph({ icon }: { icon: ShieldIconName }) {
  const common: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const glyphs: Record<ShieldIconName, ReactNode> = {
    basketball: <><circle cx="12" cy="12" r="8.25" /><path d="M3.9 9.2h16.2M3.9 14.8h16.2M8.5 4.9c2.2 2.1 3.4 4.5 3.5 7.1.1 2.6-1.1 5-3.5 7.1M15.5 4.9c-2.2 2.1-3.4 4.5-3.5 7.1-.1 2.6 1.1 5 3.5 7.1" /></>,
    team: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="7.5" r="3.5" /><path d="M16 4.4a3.5 3.5 0 0 1 0 6.8M17 15h1a3 3 0 0 1 3 3v2" /></>,
    coach: <><circle cx="12" cy="7" r="3.2" /><path d="M5 20v-1.4a7 7 0 0 1 14 0V20M9 13.4l3 2.1 3-2.1" /></>,
    league: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" /></>,
    player: <><circle cx="12" cy="6.5" r="3" /><path d="m8 11 4 2 4-2M8 11l-2 9M16 11l2 9M9.5 20l2.5-7 2.5 7" /></>,
    review: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.5A2.5 2.5 0 0 1 4 13.5Z" /><path d="m12 6 1.2 2.4 2.7.4-1.9 1.9.4 2.7-2.4-1.3-2.4 1.3.4-2.7-1.9-1.9 2.7-.4Z" /></>,
  };

  return <svg {...common}>{glyphs[icon]}</svg>;
}

export default function HexShield({
  icon = "basketball",
  tone = "orange",
  size = "md",
  className = "",
}: HexShieldProps) {
  return (
    <span className={`hc-shield hc-shield--${tone} hc-shield--${size} ${className}`.trim()} aria-hidden="true">
      <svg className="hc-shield__frame" viewBox="0 0 48 52" fill="none" aria-hidden="true">
        <path d="M24 1.5 45.5 13.8v24.4L24 50.5 2.5 38.2V13.8Z" />
      </svg>
      <span className="hc-shield__glyph"><ShieldGlyph icon={icon} /></span>
    </span>
  );
}
