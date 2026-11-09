"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export type LogoBackground = "transparent" | "light" | "dark";

const PALETTE = ["#8A2A0D", "#8C1B53", "#173C86", "#176C3D", "#4C2A90", "#7B5900"] as const;
const BLUR_TILE = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9IiNmN2Y3ZjUiLz48L3N2Zz4=";

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

function isSupabaseStorageImage(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname.endsWith(".supabase.co") &&
      url.pathname.startsWith("/storage/v1/object/");
  } catch {
    return false;
  }
}

export default function TeamLogo({
  name,
  logoUrl,
  logoBg = "transparent",
  size = 48,
  className = "",
  priority = false,
}: {
  name: string;
  logoUrl?: string | null;
  logoBg?: LogoBackground | null;
  size?: number;
  className?: string;
  priority?: boolean;
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
      style={{ width: displaySize, height: displaySize, minWidth: displaySize, background: showImage ? tileBackground : fallbackColor, overflow: "hidden" }}
    >
      {showImage ? (
        <Image
          src={logoUrl as string}
          alt=""
          width={displaySize}
          height={displaySize}
          sizes={`${displaySize}px`}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          unoptimized={!isSupabaseStorageImage(logoUrl as string)}
          placeholder="blur"
          blurDataURL={BLUR_TILE}
          onError={() => setImageFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: Math.max(3, Math.round(displaySize * 0.08)), display: "block" }}
        />
      ) : (
        <svg viewBox="0 0 100 100" aria-hidden="true" className="hc-team-logo__crest">
          <path d="M22 6H78L96 50 78 94H22L4 50Z" fill="none" stroke="#F7F7F5" strokeWidth="4" />
          <text x="50" y="57" textAnchor="middle" dominantBaseline="middle" fill="#F7F7F5" fontSize={initials(name).length > 1 ? "30" : "36"} fontWeight="900" fontFamily="Inter, Arial, sans-serif">{initials(name)}</text>
        </svg>
      )}
    </span>
  );
}
