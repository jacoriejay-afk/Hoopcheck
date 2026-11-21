"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { isProtectedFeedMedia } from "../lib/feed-media-reference";

type Props = {
  postId: string;
  reference: string;
  kind: "image" | "video";
  alt?: string;
  className?: string;
  ariaLabel?: string;
  /** In Reels, authorize only the video that actually owns the viewport. */
  active?: boolean;
  autoplay?: boolean;
  loop?: boolean;
};

export default function HoopFeedPrivateMedia({
  postId, reference, kind, alt, className, ariaLabel,
  active = true, autoplay = false, loop = false,
}: Props) {
  const isPrivate = isProtectedFeedMedia(reference);
  const [url, setUrl] = useState(isPrivate ? "" : reference);
  const [error, setError] = useState(false);
  const player = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active) {
      if (isPrivate) setUrl("");
      return;
    }
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
        // Renew image links. Resetting video URLs mid-play causes freezing and stalls;
        // a video reauthorizes when its card returns to the active viewport.
        if (kind === "image") {
          const delay = Math.max(10000, (Number(data.expires_in) || 60) * 1000 - 15000);
          refresh = setTimeout(() => { void resolve(); }, delay);
        }
      } catch {
        if (!cancelled) { setUrl(""); setError(true); }
      }
    }
    void resolve();
    return () => { cancelled = true; if (refresh) clearTimeout(refresh); };
  }, [postId, reference, isPrivate, kind, active]);

  useEffect(() => {
    if (kind !== "video") return;
    const video = player.current;
    if (!video) return;
    if (!active || !autoplay || !url) { video.pause(); return; }
    // Muted and inline autoplay is allowed on browsers that support it.
    void video.play().catch(() => { /* User can still start playback with controls. */ });
    return () => video.pause();
  }, [kind, active, autoplay, url]);

  if (!active) return <span role="status" className="muted">Scroll to view video</span>;
  if (error) return <span role="status" className="muted">Media unavailable</span>;
  if (!url) return <span role="status" className="muted">Loading media…</span>;
  if (kind === "video") return <video ref={player} src={url} controls playsInline
    preload="metadata" muted={autoplay} autoPlay={autoplay} loop={loop}
    className={className} aria-label={ariaLabel || "HoopFeed video"} />;
  return <img src={url} alt={alt || "HoopFeed post"} className={className} />;
}
