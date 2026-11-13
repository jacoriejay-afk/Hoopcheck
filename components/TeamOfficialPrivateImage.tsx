"use client";

import { useEffect, useState } from "react";

export default function TeamOfficialPrivateImage({ postId, reference, alt }: { postId: string; reference: string; alt: string }) {
  const isPrivate = reference.startsWith("hoopfeed-private-images/");
  const [url, setUrl] = useState(isPrivate ? "" : reference);
  useEffect(() => {
    if (!isPrivate) { setUrl(reference); return; }
    let active = true;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const response = await fetch("/api/team-fanfeed/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: postId }), cache: "no-store" });
        if (!response.ok) throw new Error("Image unavailable");
        const data = await response.json();
        if (active) { setUrl(data.url || ""); refresh = setTimeout(() => { void load(); }, 45000); }
      } catch { if (active) setUrl(""); }
    }
    void load();
    return () => { active = false; if (refresh) clearTimeout(refresh); };
  }, [isPrivate, postId, reference]);
  if (!url) return <span role="status" className="muted">Image unavailable</span>;
  return <img src={url} alt={alt} loading="lazy" style={{ display: "block", width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, marginTop: 12 }} />;
}
