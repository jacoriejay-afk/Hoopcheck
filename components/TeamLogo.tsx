"use client";

import { useMemo, useState } from "react";

export type LogoBackground = "transparent" | "light" | "dark";

const PALETTE = ["#FF5A1F", "#E84393", "#2456C8", "#1E9E50", "#6C3FD4", "#F5B800"] as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "HC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function hashName(name: string) {
  let hash = 2166136261;
  for (const char of name.toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % PALETTE.length;
}

export default function TeamLogo({
  name,
  logoUrl,
  logoBg = "transparent",
  size = 48,
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  logoBg?: LogoBackground | null;
  size?: number;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackColor = useMemo(() => PALETTE[hashName(name)], [name]);
  const showImage = Boolean(logoUrl && !imageFailed);
  const tileBackground = logoBg === "light" ? "#F7F7F5" : logoBg === "dark" ? "#0A0A0A" : "transparent";

  return (
    <span
      className={`hc-team-logo ${showImage ? "hc-team-logo--image" : "hc-team-logo--fallback"} ${className}`.trim()}
      role="img"
      aria-label={`${name} team logo`}
      style={{ width: size, height: size, minWidth: size, background: showImage ? tileBackground : fallbackColor }}
    >
      {showImage ? (
        <img
          src={logoUrl as string}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setImageFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: Math.max(3, Math.round(size * 0.08)), display: "block" }}
        />
      ) : (
        <svg viewBox="0 0 100 100" aria-hidden="true" className="hc-team-logo__crest">
          <path d="M50 5 88 20v28c0 22-15 37-38 47C27 85 12 70 12 48V20Z" fill="none" stroke="#F7F7F5" strokeWidth="4" />
          <text x="50" y="57" textAnchor="middle" dominantBaseline="middle" fill="#F7F7F5" fontSize={initials(name).length > 1 ? "30" : "36"} fontWeight="900" fontFamily="Inter, Arial, sans-serif">{initials(name)}</text>
        </svg>
      )}
    </span>
  );
}
