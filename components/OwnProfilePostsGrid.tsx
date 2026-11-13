"use client";

import HoopFeedPrivateMedia from "./HoopFeedPrivateMedia";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ProfilePost = { id: string; body: string | null; image_url: string | null; video_url: string | null; created_at: string; is_pinned: boolean; pinned_at: string | null };
export default function OwnProfilePostsGrid({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinBusy, setPinBusy] = useState<string | null>(null);
  const [pinError, setPinError] = useState("");
  async function togglePin(post: ProfilePost) {
    if (pinBusy) return;
    setPinBusy(post.id);
    setPinError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || session.user.id !== userId) throw new Error("Sign in to manage your posts.");
      const form = new FormData();
      form.set("kind", "pin"); form.set("post_id", post.id); form.set("pinned", String(!post.is_pinned));
      const response = await fetch("/api/hoopfeed/moderate", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
      const result = await response.json();
      if (!response.ok || result.allowed !== true) throw new Error(result.message || "Could not update pin.");
      setPosts(current => current.map(item => item.id === post.id ? { ...item, is_pinned: !post.is_pinned, pinned_at: !post.is_pinned ? new Date().toISOString() : null } : item));
    } catch (error) { setPinError(error instanceof Error ? error.message : "Could not update pin."); }
    finally { setPinBusy(null); }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user || user.id !== userId) { setPosts([]); setLoading(false); return; }
      const { data, error } = await supabase.from("feed_posts")
        .select("id,body,image_url,video_url,created_at,is_pinned,pinned_at")
        .eq("author_id", user.id).eq("status", "approved")
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
      {pinError && <p role="alert">{pinError}</p>}
      {loading ? <p className="hc-pastel-posts__empty">Loading your posts…</p> : posts.length === 0
        ? <p className="hc-pastel-posts__empty">No posts yet. Your approved HoopFeed posts appear here and remain available.</p>
        : <div className="hc-pastel-posts__grid">
          {posts.slice().sort((a,b) => Number(b.is_pinned) - Number(a.is_pinned) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(post => <article key={post.id} className="hc-pastel-posts__tile" aria-label={post.body || "HoopFeed media post"}>
            {post.image_url ? <HoopFeedPrivateMedia postId={post.id} reference={post.image_url} kind="image" alt={post.body || "HoopFeed photo"} />
              : post.video_url ? <HoopFeedPrivateMedia postId={post.id} reference={post.video_url} kind="video" ariaLabel={post.body || "HoopFeed video"} />
              : <p>{post.body || "HoopFeed post"}</p>}
            <button type="button" disabled={pinBusy !== null} onClick={() => void togglePin(post)} aria-label={post.is_pinned ? "Unpin your post" : "Pin your post to your profile"}>{post.is_pinned ? "📌 Unpin" : "📌 Pin to profile"}</button>
            {post.video_url && <span className="hc-pastel-posts__video-mark" aria-hidden="true">▶</span>}
          </article>)}
        </div>}
    </section>
  );
}
