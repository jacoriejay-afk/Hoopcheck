"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import HoopLoading from "../../../components/HoopLoading";
import Logo from "../../../components/Logo";

type Post = {
  id: string;
  team_id: string;
  author_id: string;
  body: string;
  status: "published" | "removed";
  created_at: string;
  updated_at: string;
  teams: { name: string; logo_url: string | null } | null;
};

export default function AdminTeamFanFeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "published" | "removed">("all");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      window.location.href = "/login";
      return;
    }
    const response = await fetch("/api/admin/team-fanfeed", {
      headers: { Authorization: "Bearer " + session.access_token },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (response.status === 403) {
      window.location.href = "/dashboard";
      return;
    }
    if (!response.ok) {
      setMessage(payload.error || "Official team updates could not be loaded.");
      setLoading(false);
      return;
    }
    setPosts((payload.posts || []) as Post[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function moderate(post: Post, status: "published" | "removed") {
    if (busyId) return;
    if (status === "removed" && !window.confirm("Hide this official team update from FanFeed? It can be restored later.")) return;
    setBusyId(post.id);
    setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      window.location.href = "/login";
      return;
    }
    const response = await fetch("/api/admin/team-fanfeed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ id: post.id, status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(payload.error || "Moderation action failed.");
    else {
      setPosts(current => current.map(item => item.id === post.id ? { ...item, status } : item));
      setMessage(status === "removed" ? "Official update hidden. It remains available for restoration." : "Official update restored.");
    }
    setBusyId(null);
  }

  const visible = posts.filter(post => filter === "all" || post.status === filter);

  if (loading) return <main className="page-shell admin-light-shell"><div className="page-container"><HoopLoading label="Loading official Team FanFeed moderation..." /></div></main>;

  return <main className="page-shell admin-light-shell"><div className="page-container">
    <header className="topbar">
      <Link href="/admin/directory" className="brand" aria-label="HoopCheck Admin"><Logo variant="full" size={30} /></Link>
      <nav className="topnav"><Link href="/admin/directory">Control Center</Link><Link href="/admin/claims">Profile Claims</Link><Link href="/admin/reviews">Reviews</Link></nav>
    </header>
    <section className="hero-card">
      <p className="eyebrow">ADMIN · TEAM PARTNERSHIPS</p>
      <h1>Official Team FanFeed</h1>
      <p className="muted">Review official team announcements. Hide a post from fans or restore it later. This does not change player reviews or independent fan posts.</p>
    </section>
    {message && <p className="hc-claim-admin-message" role="status">{message}</p>}
    <div className="hc-claim-admin-summary">
      <strong>{posts.filter(post => post.status === "published").length}</strong><span>Published</span>
      <strong>{posts.filter(post => post.status === "removed").length}</strong><span>Hidden</span>
      <strong>{posts.length}</strong><span>Total updates</span>
    </div>
    <div className="hc-claim-admin-actions" role="group" aria-label="Filter official team updates">
      {(["all", "published", "removed"] as const).map(value => <button key={value} type="button" className={filter === value ? "btn" : "btn dark"} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "published" ? "Published" : "Hidden"}</button>)}
      <button type="button" className="btn dark" onClick={() => void load()}>Refresh</button>
    </div>
    <section className="hc-claim-admin-list">
      {visible.map(post => <article className="dashboard-card hc-claim-admin-card" key={post.id}>
        <div className="hc-claim-admin-card__top">
          <div><span className={"hc-claim-admin-status is-" + post.status}>{post.status}</span><h2>{post.teams?.name || "Team profile"}</h2><p className="muted">Posted {new Date(post.created_at).toLocaleString()}</p></div>
          <Link href={"/teams/" + post.team_id} className="hc-claim-admin-open">Open team →</Link>
        </div>
        {post.image_url && <img src={post.image_url} alt="Official team post attachment" style={{ display: "block", width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 12, marginBottom: 12 }} />}\n        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{post.body}</p>
        <p className="muted">Author ID: {post.author_id}</p>
        <div className="hc-claim-admin-actions">
          {post.status === "published"
            ? <button type="button" className="btn dark" disabled={busyId === post.id} onClick={() => void moderate(post, "removed")}>{busyId === post.id ? "Saving…" : "Hide from FanFeed"}</button>
            : <button type="button" className="btn" disabled={busyId === post.id} onClick={() => void moderate(post, "published")}>{busyId === post.id ? "Saving…" : "Restore to FanFeed"}</button>}
        </div>
      </article>)}
      {!visible.length && <div className="dashboard-card"><h2>No updates in this view</h2><p className="muted">Official team posts will appear here when teams publish them.</p></div>}
    </section>
  </div></main>;
}
