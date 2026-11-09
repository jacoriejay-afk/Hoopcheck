"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ProfilePost = { id: string; body: string | null; image_url: string | null; video_url: string | null; created_at: string };
export default function OwnProfilePostsGrid({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user || user.id !== userId) { setPosts([]); setLoading(false); return; }
      const { data, error } = await supabase.from("feed_posts")
        .select("id,body,image_url,video_url,created_at")
        .eq("author_id", user.id).eq("status", "approved")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(9);
      if (!active) return;
      setPosts(error ? [] : (data || []) as ProfilePost[]);
      setLoading(false);
    })().catch(() => { if (active) { setPosts([]); setLoading(false); } });
    return () => { active = false; };
  }, [userId]);
  return (
    <section className="hc-pastel-posts" aria-label="Your recent HoopFeed posts">
      <div className="hc-pastel-posts__heading"><h2>Posts</h2><span>Recent HoopFeed</span></div>
      {loading ? <p className="hc-pastel-posts__empty">Loading your posts…</p> : posts.length === 0
        ? <p className="hc-pastel-posts__empty">No active posts yet. Your approved HoopFeed posts appear here while they are live.</p>
        : <div className="hc-pastel-posts__grid">
          {posts.map(post => <article key={post.id} className="hc-pastel-posts__tile" aria-label={post.body || "HoopFeed media post"}>
            {post.image_url ? <img src={post.image_url} alt={post.body || "HoopFeed photo"} loading="lazy" />
              : post.video_url ? <video src={post.video_url} preload="none" muted playsInline aria-label={post.body || "HoopFeed video"} />
              : <p>{post.body || "HoopFeed post"}</p>}
            {post.video_url && <span className="hc-pastel-posts__video-mark" aria-hidden="true">▶</span>}
          </article>)}
        </div>}
    </section>
  );
}
