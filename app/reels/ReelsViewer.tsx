"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageShell } from "../../components/LayoutSystem";
import HoopFeedPrivateMedia from "../../components/HoopFeedPrivateMedia";
import { supabase } from "../../lib/supabase";
import { getHoopCheckEntitlements } from "../../lib/membership-tier";
import "./reels.css";

type Reel = {
  id: string;
  author_id: string;
  body: string | null;
  video_url: string;
  created_at: string;
  profiles: { display_name: string | null; account_type: string | null } | null;
};
type Cursor = { id: string; created_at: string };
type Status = "loading" | "signin" | "locked" | "ready" | "error";
const LIMIT = 10;

export default function ReelsViewer() {
  const [status, setStatus] = useState<Status>("loading");
  const [viewerId, setViewerId] = useState("");
  const [reels, setReels] = useState<Reel[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [message, setMessage] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const ratios = useRef(new Map<string, number>());
  const busy = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async (id: string, after: Cursor | null) => {
    if (busy.current) return;
    busy.current = true;
    setLoadingMore(Boolean(after));
    try {
      let query = supabase.from("feed_posts")
        .select("id,author_id,body,video_url,created_at,profiles:profiles!feed_posts_author_id_fkey(display_name,account_type)")
        .eq("status", "approved").not("video_url", "is", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .limit(LIMIT + 1);
      if (after) query = query.or(`created_at.lt.${after.created_at},and(created_at.eq.${after.created_at},id.lt.${after.id})`);
      const result = await query;
      if (result.error) throw result.error;
      const page = (result.data ?? []).slice(0, LIMIT);
      const hiddenResult = page.length
        ? await supabase.from("feed_post_archives").select("post_id").eq("user_id", id).in("post_id", page.map(post => post.id))
        : { data: [], error: null };
      if (hiddenResult.error) throw hiddenResult.error;
      if (!mounted.current) return;
      // Existing archives can only be written by the post author. Keep viewer
      // hides local; never attempt to bypass the existing RLS policy.
      let locallyHidden: string[] = [];
      let mutedCreators: string[] = [];
      try {
        const savedPosts: unknown = JSON.parse(window.localStorage.getItem(`hoopcheck-reels-hidden:${id}`) || "[]");
        const savedAuthors: unknown = JSON.parse(window.localStorage.getItem(`hoopcheck-reels-muted-creators:${id}`) || "[]");
        if (Array.isArray(savedPosts)) locallyHidden = savedPosts.filter(value => typeof value === "string").slice(-500);
        if (Array.isArray(savedAuthors)) mutedCreators = savedAuthors.filter(value => typeof value === "string").slice(-500);
      } catch { /* Storage is optional on private browsing devices. */ }
      const excluded = new Set([...(hiddenResult.data ?? []).map(row => row.post_id), ...locallyHidden]);
      const muted = new Set(mutedCreators);
      const incoming = page.filter(row => !excluded.has(row.id) && !muted.has(row.author_id) && Boolean(row.video_url)).map(row => ({
        ...row,
        video_url: row.video_url as string,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
      })) as Reel[];
      setReels(previous => after
        ? [...new Map([...previous, ...incoming].map(post => [post.id, post])).values()]
        : incoming);
      setCursor(result.data && result.data.length > LIMIT ? { id: page[page.length - 1].id, created_at: page[page.length - 1].created_at } : null);
      setMessage("");
      setStatus("ready");
    } catch {
      if (mounted.current) {
        if (!after) setStatus("error");
        setMessage("Reels couldn't load. Please try again.");
      }
    } finally {
      busy.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    async function start() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) { if (!cancelled) setStatus("signin"); return; }
        const id = session.user.id;
        const [profile, subscription, role] = await Promise.all([
          supabase.from("profiles").select("account_type").eq("id", id).maybeSingle(),
          supabase.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", id).maybeSingle(),
          supabase.rpc("get_current_user_admin_role"),
        ]);
        if (cancelled) return;
        if (profile.error || subscription.error || role.error) throw Error("Membership unavailable");
        const canRead = getHoopCheckEntitlements({
          accountType: profile.data?.account_type,
          subscription: subscription.data,
          isAdmin: role.data === "admin",
        }).canReadHoopFeed;
        if (!canRead) { setStatus("locked"); return; }
        setViewerId(id);
        await load(id, null);
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    void start();
    return () => { cancelled = true; mounted.current = false; };
  }, [load]);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (status !== "ready" || !viewport.current) return;
    const root = viewport.current;
    ratios.current.clear();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.reelId;
        if (id) ratios.current.set(id, entry.intersectionRatio);
      }
      let winner: string | null = null;
      let best = 0.65; // Never autoplay two partially visible cards.
      for (const [id, value] of ratios.current) if (value > best) { best = value; winner = id; }
      setActive(winner);
    }, { root, threshold: [0, 0.25, 0.5, 0.65, 0.75, 0.9, 1] });
    root.querySelectorAll("[data-reel-id]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [reels, status]);

  function hidePost(postId: string) {
    if (!viewerId) return;
    try {
      const key = `hoopcheck-reels-hidden:${viewerId}`;
      const previous = JSON.parse(window.localStorage.getItem(key) || "[]");
      const ids: string[] = Array.isArray(previous) ? previous.filter(id => typeof id === "string") : [];
      window.localStorage.setItem(key, JSON.stringify([...new Set([...ids, postId])].slice(-500)));
    } catch { /* Hiding still works for this open session if local storage is blocked. */ }
    setReels(current => current.filter(post => post.id !== postId));
  }

  function hideCreator(authorId: string) {
    if (!viewerId) return;
    try {
      const key = `hoopcheck-reels-muted-creators:${viewerId}`;
      const previous: unknown = JSON.parse(window.localStorage.getItem(key) || "[]");
      const authors = Array.isArray(previous) ? previous.filter(value => typeof value === "string") : [];
      window.localStorage.setItem(key, JSON.stringify([...new Set([...authors, authorId])].slice(-500)));
    } catch { /* The current session is still filtered if storage is unavailable. */ }
    setReels(current => current.filter(post => post.author_id !== authorId));
    setMessage("This creator's Reels are hidden in this browser. This does not block their account elsewhere.");
  }

  async function sharePost(postId: string) {
    const url = `${window.location.origin}/feed#post-${postId}`;
    if (navigator.share) {
      try { await navigator.share({ title: "HoopCheck Reel", url }); }
      catch { /* The user dismissed the native share sheet. */ }
    } else {
      try { await navigator.clipboard.writeText(url); setMessage("Video link copied."); }
      catch { setMessage("Your browser couldn't copy the link."); }
    }
  }

  return <PageShell><main className="hc-reels-page">
    <header className="hc-reels-top">
      <div><p className="hc-reels-eyebrow">HOOPCHECK™</p><h1>Reels<span>.</span></h1><p>Real basketball. Real moments.</p></div>
      <Link href="/feed" className="hc-reels-back">HoopFeed</Link>
    </header>
    {status === "loading" && <div className="hc-reels-state" role="status">Loading basketball videos…</div>}
    {status === "signin" && <div className="hc-reels-state"><h2>Join HoopFeed to watch Reels</h2><p>Sign in to view community videos.</p><Link className="btn" href="/login?returnTo=%2Freels">Sign in</Link></div>}
    {status === "locked" && <div className="hc-reels-state"><h2>HoopFeed membership required</h2><p>Reels follow the same Pro and Premium access rules as HoopFeed.</p><Link className="btn" href="/membership">See memberships</Link></div>}
    {status === "error" && <div className="hc-reels-state" role="alert"><h2>Reels unavailable</h2><p>Refresh to try again. Your account and videos are unchanged.</p><button type="button" onClick={() => window.location.reload()}>Refresh</button></div>}
    {status === "ready" && <>
      {message && <p className="hc-reels-alert" role="status">{message}</p>}
      {reels.length ? <div className="hc-reels-scroll" ref={viewport} aria-label="Basketball video Reels">
        {reels.map(post => <article key={post.id} className="hc-reel" data-reel-id={post.id}>
          <div className="hc-reel-video">
            <HoopFeedPrivateMedia postId={post.id} reference={post.video_url} kind="video"
              active={!hidden && active === post.id} autoplay loop className="hc-reel-player"
              ariaLabel={`HoopFeed Reel by ${post.profiles?.display_name || "HoopCheck member"}`} />
          </div>
          <div className="hc-reel-caption">
            <div><strong>{post.profiles?.display_name || "HoopCheck member"}</strong>
              <small>{post.profiles?.account_type || "Community"} · {new Date(post.created_at).toLocaleDateString()}</small></div>
            {post.body && <p>{post.body.slice(0, 2000)}</p>}
            <nav aria-label="Reel actions">
              <Link href={`/feed#post-${post.id}`}>Check & comment</Link>
              <button type="button" onClick={() => void sharePost(post.id)}>Share</button>
              <Link href={`/support?reportReel=${post.id}`} aria-label="Report this Reel to HoopCheck support">Report</Link>
              <button type="button" onClick={() => hidePost(post.id)}>Hide</button>
              {post.author_id !== viewerId && <button type="button" onClick={() => hideCreator(post.author_id)}>Hide creator</button>}
            </nav>
          </div>
        </article>)}
      </div> : <div className="hc-reels-state"><h2>No videos yet</h2><p>Video posts you can view will appear here. Post a clip from HoopFeed.</p><Link href="/feed">Open HoopFeed</Link></div>}
      {cursor && <div className="hc-reels-more"><button type="button" disabled={loadingMore} onClick={() => void load(viewerId, cursor)}>{loadingMore ? "Loading…" : "More Reels"}</button></div>}
    </>}
  </main></PageShell>;
}
