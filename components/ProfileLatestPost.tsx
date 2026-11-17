"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import HoopFeedPrivateMedia from "./HoopFeedPrivateMedia";

type LatestPost = { id: string; body: string | null; image_url: string | null; video_url: string | null; created_at: string; expires_at: string | null };
export default function ProfileLatestPost({ userId }: { userId: string }) {
  const [post, setPost] = useState<LatestPost | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function load() {
      // Use the viewer's Supabase session and existing row-level security; never use service-role access.
      const { data, error } = await supabase.from("feed_posts")
        .select("id,body,image_url,video_url,created_at,expires_at")
        .eq("author_id", userId).eq("status", "approved")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false }).limit(1);
      if (active) { setPost(error ? null : (data?.[0] as LatestPost | undefined) ?? null); setLoading(false); }
    }
    void load().catch(() => { if (active) { setPost(null); setLoading(false); } });
    // Clear an expiring post from the profile without requiring a page reload.
    const interval = setInterval(() => {
      setPost(current => current?.expires_at && Date.parse(current.expires_at) <= Date.now() ? null : current);
    }, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [userId]);
  return <section className="dashboard-card compact-section" aria-label="Latest HoopFeed post">
    <h2>Latest Post</h2>
    {loading ? <p className="muted">Loading latest post…</p> : !post ? <p className="muted">No visible posts yet.</p> :
      <article>
        <p className="muted"><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time></p>
        {post.body && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{post.body}</p>}
        {post.image_url ? <HoopFeedPrivateMedia postId={post.id} reference={post.image_url} kind="image" alt="Latest post photo" /> :
          post.video_url ? <HoopFeedPrivateMedia postId={post.id} reference={post.video_url} kind="video" ariaLabel="Latest post video" /> : null}
        <p><Link href="/feed">Open HoopFeed</Link></p>
      </article>}
  </section>;
}
