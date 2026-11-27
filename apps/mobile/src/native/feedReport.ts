import type { SupabaseClient } from "@supabase/supabase-js";
import { readWithDeadline } from "./readDeadline";

type FeedReportTarget = { uid: string; postId: string; authorId: string; commentId?: string };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function validFeedReportTarget({ uid, postId, authorId, commentId }: FeedReportTarget) {
  return uid !== authorId && uuid.test(uid) && uuid.test(postId) && uuid.test(authorId) &&
    (commentId === undefined || uuid.test(commentId));
}

export async function reportVisibleFeedContent(
  client: SupabaseClient,
  target: FeedReportTarget,
  reason: string,
  signal: AbortSignal,
  active: () => boolean,
) {
  const { uid, postId, authorId, commentId } = target;
  const clean = reason.trim();
  if (!validFeedReportTarget(target) || clean.length < 10 || clean.length > 500) throw new Error("Specify the content and a reason.");
  const { data: { session }, error: sessionError } = await readWithDeadline(() => client.auth.getSession());
  if (sessionError || session?.user.id !== uid || signal.aborted || !active()) throw new Error("Verify your account.");
  const header = "Bearer " + session.access_token;
  const post = await client.from("feed_posts").select("id,author_id,video_url")
    .eq("id", postId).eq("status", "approved").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .setHeader("Authorization", header).abortSignal(signal).maybeSingle();
  if (post.error || post.data?.id !== postId || (!commentId && post.data.author_id !== authorId)) {
    throw new Error("Post unavailable.");
  }
  if (commentId) {
    const comment = await client.from("feed_post_comments").select("id,author_id")
      .eq("id", commentId).eq("post_id", postId).setHeader("Authorization", header).abortSignal(signal).maybeSingle();
    if (comment.error || comment.data?.id !== commentId || comment.data.author_id !== authorId) throw new Error("Comment unavailable.");
  }
  if (signal.aborted || !active()) throw new Error("Account changed.");
  const videoReport = !commentId && typeof post.data.video_url === "string" && post.data.video_url.length > 0;
  const description = `${videoReport ? "Reel" : "Post"}: https://hoopcheck.online/feed#post-${postId}\n${commentId ? "Comment ID: " + commentId + "\n" : ""}Reason: ${clean}`;
  const response = await client.from("support_tickets").insert({
    requester_id: uid,
    subject: commentId ? "Report a HoopFeed comment" : videoReport ? "Report a HoopFeed Reel" : "Report a HoopFeed post",
    category: "security",
    priority: "normal",
    description,
  }).setHeader("Authorization", header).abortSignal(signal);
  if (response.error) throw new Error("Report submission not confirmed.");
}
