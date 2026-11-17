"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function TeamOfficialPrivateImage({ postId, reference, alt }: { postId: string; reference: string; alt: string }) {
  const [media, setMedia] = useState<{ postId: string; reference: string; url: string } | null>(null);
  const url = media?.postId === postId && media.reference === reference ? media.url : "";
  useEffect(() => {
    let active = true;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sign in required");
        const response = await fetch("/api/team-fanfeed/media", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ post_id: postId }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Image unavailable");
        const data = await response.json();
        if (active) { setMedia({ postId, reference, url: data.url || "" }); refresh = setTimeout(() => { void load(); }, 45000); }
      } catch { if (active) setMedia({ postId, reference, url: "" }); }
    }
    void load();
    return () => { active = false; if (refresh) clearTimeout(refresh); };
  }, [postId, reference]);
  if (!media || media.postId !== postId || media.reference !== reference) return <span role="status" className="muted">Loading image…</span>;
  if (!url) return <span role="status" className="muted">Image unavailable</span>;
  return <img src={url} alt={alt} loading="lazy" style={{ display: "block", width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 12, marginTop: 12 }} />;
}
