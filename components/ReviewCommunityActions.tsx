"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ReviewComment = {
  id: string;
  body: string;
  created_at: string;
  profiles?: { display_name?: string | null } | null;
};

export default function ReviewCommunityActions({ reviewId }: { reviewId: string }) {
  const [likes, setLikes] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [commentsUnavailable, setCommentsUnavailable] = useState(false);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");

    const [{ data: sessionData }] = await Promise.all([supabase.auth.getSession()]);
    const user = sessionData.session?.user;

    if (user) {
      const { data: count, error: countError } = await supabase.rpc(
        "get_review_like_count",
        { p_review_id: reviewId },
      );
      setLikes(countError ? null : Number(count) || 0);

      const { data: ownLike, error: ownLikeError } = await supabase
        .from("review_likes")
        .select("id")
        .eq("review_id", reviewId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ownLikeError) setLiked(!!ownLike);
    } else {
      setLikes(null);
      setLiked(false);
    }

    const { data: commentRows, error: commentsError } = await supabase
      .from("review_comments")
      .select("id,body,created_at,profiles(display_name)")
      .eq("review_id", reviewId)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    if (commentsError) {
      setComments([]);
      setCommentsUnavailable(true);
    } else {
      setCommentsUnavailable(false);
      setComments((commentRows || []) as ReviewComment[]);
    }
    setLoading(false);
  }, [reviewId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function like() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }

      if (liked) {
        const { error } = await supabase
          .from("review_likes")
          .delete()
          .eq("review_id", reviewId)
          .eq("user_id", user.id);
        if (error) throw error;
        setLiked(false);
        setLikes((value) => value === null ? null : Math.max(0, value - 1));
      } else {
        const { error } = await supabase
          .from("review_likes")
          .insert({ review_id: reviewId, user_id: user.id });
        if (error) throw error;
        setLiked(true);
        setLikes((value) => value === null ? null : value + 1);
      }
    } catch {
      setMsg("Your like could not be updated. Please try again.");
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function comment() {
    if (busy) return;
    const trimmedBody = body.trim();
    if (!trimmedBody) return;
    setBusy(true);
    setMsg("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const { error } = await supabase
        .from("review_comments")
        .insert({ review_id: reviewId, author_id: user.id, body: trimmedBody });
      if (error) throw error;
      setBody("");
      setMsg("Comment submitted for moderation.");
    } catch {
      setMsg("Your comment could not be submitted. Check your account access and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="btn dark" onClick={like} disabled={busy || loading} aria-pressed={liked}>
          {liked ? "♥" : "♡"} {likes === null ? "Like" : likes}
        </button>
        <span className="muted">
          {loading
            ? "Loading comments…"
            : commentsUnavailable
              ? "Comments unavailable"
              : `${comments.length} comments`}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Comment on this review..."
          maxLength={1000}
          aria-label="Comment on this review"
        />
        <button type="button" className="btn" onClick={comment} disabled={busy || !body.trim()}>
          {busy ? "Please wait…" : "Comment"}
        </button>
      </div>
      {msg && <small className="muted" role="status">{msg}</small>}
      <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
        {comments.map((item) => (
          <div key={item.id}>
            <strong>{item.profiles?.display_name || "Player"}</strong>
            <span> {item.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
