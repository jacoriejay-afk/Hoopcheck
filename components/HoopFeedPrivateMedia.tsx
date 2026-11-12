"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const PRIVATE_PREFIXES = ["hoopfeed-private-images/", "hoopfeed-private-videos/"];

type Props = {
  postId: string;
  reference: string;
  kind: "image" | "video";
  alt?: string;
  className?: string;
  ariaLabel?: string;
};

/** Public legacy URLs remain readable; new private references require post-scoped authorization. */
export default function HoopFeedPrivateMedia({ postId, reference, kind, alt, className, ariaLabel }: Props) {
  const isPrivate = PRIVATE_PREFIXES.some(prefix => reference.startsWith(prefix));
  const [url, setUrl] = useState(isPrivate ? "" : reference);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isPrivate) { setUrl(reference); setError(false); return; }
    let cancelled = false;
    let refresh: ReturnType<typeof setTimeout> | undefined;

    async function resolve() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { if (!cancelled) { setUrl(""); setError(true); } return; }
      try {
        const response = await fetch("/api/hoopfeed/media", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ post_id: postId, media_url: reference }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Media authorization failed");
        const data: { url?: string; expires_in?: number } = await response.json();
        if (!data.url) throw new Error("Missing media URL");
        if (cancelled) return;
        setUrl(data.url);
        setError(false);
        // Refresh before the short-lived signed link expires. Playback may need a new URL.
        const delay = Math.max(10000, (Number(data.expires_in) || 60) * 1000 - 15000);
        // Replacing a playing video URL resets playback. Refresh images only;
        // videos retain their signed URL for the active playback session.
        if (kind === "image") refresh = setTimeout(() => { void resolve(); }, delay);
      } catch {
        if (!cancelled) { setUrl(""); setError(true); }
      }
    }
    void resolve();
    return () => { cancelled = true; if (refresh) clearTimeout(refresh); };
  }, [postId, reference, isPrivate, kind]);

  if (error) return <span role="status" className="muted">Media unavailable</span>;
  if (!url) return <span role="status" className="muted">Loading media…</span>;
  if (kind === "video") return <video src={url} controls playsInline preload="metadata" className={className} aria-label={ariaLabel || "HoopFeed video"} />;
  return <img src={url} alt={alt || "HoopFeed post"} className={className} />;
}
