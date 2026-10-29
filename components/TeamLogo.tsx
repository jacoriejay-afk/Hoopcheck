"use client";

import { useEffect, useMemo, useState } from "react";

export type LogoBackground = "transparent" | "light" | "dark";

const PALETTE = ["#8A2A0D", "#8C1B53", "#173C86", "#176C3D", "#4C2A90", "#7B5900"] as const;

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
  useEffect(() => { setImageFailed(false); }, [logoUrl]);
  const showImage = Boolean(logoUrl && !imageFailed);
  const displaySize = Math.min(256, Math.max(24, size));
  const tileBackground = logoBg === "light" ? "#F7F7F5" : logoBg === "dark" ? "#0A0A0A" : "transparent";

  return (
    <span
      className={`hc-team-logo ${showImage ? "hc-team-logo--image" : "hc-team-logo--fallback"} ${className}`.trim()}
      role="img"
      aria-label={`${name} team logo`}
      style={{ width: displaySize, height: displaySize, minWidth: displaySize, background: showImage ? tileBackground : fallbackColor }}
    >
      {showImage ? (
        <img
          src={logoUrl as string}
          alt=""
          width={displaySize}
          height={displaySize}
          loading="lazy"
          onError={() => setImageFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: Math.max(3, Math.round(displaySize * 0.08)), display: "block" }}
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
