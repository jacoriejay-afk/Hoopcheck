"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";

type Team = { id: string; name: string; country: string | null; city: string | null };
type Claim = { id: string; entity_id: string; status: "pending" | "approved" | "rejected"; created_at: string };
type Post = { id: string; team_id: string; author_id: string; body: string; image_url: string | null; created_at: string; status: string };

export default function TeamDashboardPage() {
  const [userId, setUserId] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [teamId, setTeamId] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (uid: string) => {
    const { data: claimRows, error } = await supabase.from("profile_claim_requests")
      .select("id,entity_id,status,created_at").eq("requester_id", uid).eq("entity_type", "team")
      .order("created_at", { ascending: false }).limit(100);
    if (error) { setMessage("Your team claim status could not be loaded."); return; }
    const rows = (claimRows || []) as Claim[];
    setClaims(rows);
    const approvedIds = Array.from(new Set(rows.filter(c => c.status === "approved").map(c => c.entity_id)));
    if (!approvedIds.length) { setTeams([]); setPosts([]); setTeamId(""); return; }
    const { data: teamRows } = await supabase.from("teams").select("id,name,country,city").in("id", approvedIds).order("name");
    const list = (teamRows || []) as Team[];
    setTeams(list);
    setTeamId(current => list.some(t => t.id === current) ? current : list[0]?.id || "");
    const { data: postRows } = await (supabase as any).from("team_fanfeed_posts")
      .select("id,team_id,author_id,body,image_url,created_at,status").in("team_id", approvedIds)
      .eq("author_id", uid).order("created_at", { ascending: false }).limit(100);
    setPosts((postRows || []) as Post[]);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      if (!active) return;
      setUserId(user.id);
      await load(user.id);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [load]);

  async function publish() {
    if (!userId || !teamId || !body.trim() || posting) return;
    setPosting(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData();
      form.set("team_id", teamId);
      form.set("body", body.trim());
      if (image) form.set("image", image);
      const response = await fetch("/api/team-fanfeed", {
        method: "POST",
        headers: { Authorization: "Bearer " + session?.access_token },
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.allowed) throw new Error(result.message || "Your update could not be published.");
      setBody(""); setImage(null);
      setMessage("Your official team update is live on FanFeed.");
      await load(userId);
    } catch (error: any) {
      setMessage(error?.message || "Your update could not be published.");
    } finally {
      setPosting(false);
    }
  }

  async function remove(post: Post) {
    if (!window.confirm("Delete this official team update?")) return;
    const { error } = await (supabase as any).from("team_fanfeed_posts")
      .delete().eq("id", post.id).eq("author_id", userId);
    if (error) setMessage("The update could not be deleted.");
    else { setPosts(current => current.filter(p => p.id !== post.id)); setMessage("Official update deleted."); }
  }

  if (loading) return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading team dashboard..." /></div></main>;

  const approvedCount = claims.filter(c => c.status === "approved").length;
  const pendingCount = claims.filter(c => c.status === "pending").length;

  return <main className="page-shell"><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/teams">Teams</Link><Link href="/fan-feed">FanFeed</Link></nav></header>
    <section className="hero-card">
      <p className="eyebrow">HOOPCHECK · TEAM PARTNERSHIPS</p>
      <h1>Team Dashboard</h1>
      <p className="muted">Manage your claimed team profile and publish official updates for supporters.</p>
    </section>
    {message && <p className="hc-claim-message" role="status">{message}</p>}
    {!approvedCount ? <section className="dashboard-card" style={{ marginTop: 18 }}>
      <h2>{pendingCount ? "Your claim is under review" : "Represent a basketball team?"}</h2>
      <p className="muted">{pendingCount ? "HoopCheck is reviewing your organization evidence. Team publishing unlocks after approval." : "Find your club in the directory and submit an official team profile claim. Once approved, you can publish official FanFeed updates."}</p>
      <Link className="btn" href="/teams">Find your team</Link>
      {pendingCount > 0 && <p className="muted" style={{ marginTop: 12 }}>{pendingCount} pending claim{pendingCount === 1 ? "" : "s"}</p>}
    </section> : <>
      <section className="dashboard-card" style={{ marginTop: 18, padding: 20 }}>
        <p className="eyebrow">OFFICIAL TEAM FANFEED</p>
        <h2>Publish an update</h2>
        <label className="hc-claim-field">Team<select value={teamId} onChange={e => setTeamId(e.target.value)}>{teams.map(team => <option key={team.id} value={team.id}>{team.name} · {[team.city, team.country].filter(Boolean).join(", ")}</option>)}</select></label>
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1000} rows={5} placeholder="Share an official announcement, roster update, game information, or club news…" style={{ width: "100%", marginTop: 12 }} />
        <label className="hc-claim-field" style={{ display: "block", marginTop: 12 }}>Attach a team photo (optional)\n          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImage(e.target.files?.[0] || null)} />\n        </label>
        <small className="muted">JPG, PNG, or WebP · Maximum 8 MB · Images are safety-screened before publication.</small>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <small className="muted">{body.length}/1000 · Published updates are labelled as official team communications.</small>
          <button className="btn" disabled={posting || !teamId || !body.trim()} onClick={() => void publish()}>{posting ? "Publishing…" : "Publish to FanFeed"}</button>
        </div>
      </section>
      <section style={{ marginTop: 22 }}>
        <div className="section-heading"><div><p className="eyebrow">YOUR ORGANIZATIONS</p><h2>Claimed team profiles</h2></div></div>
        <div style={{ display: "grid", gap: 12 }}>{teams.map(team => <article className="dashboard-card" key={team.id} style={{ padding: 18 }}>
          <h3>{team.name}</h3><p className="muted">{[team.city, team.country].filter(Boolean).join(", ")}</p>
          <Link href={"/teams/" + team.id} className="btn">View public profile</Link>
        </article>)}</div>
      </section>
      <section style={{ marginTop: 22 }}>
        <div className="section-heading"><div><p className="eyebrow">PUBLISHED BY YOUR TEAM</p><h2>Manage official updates</h2></div></div>
        <div style={{ display: "grid", gap: 12 }}>{posts.map(post => <article className="dashboard-card" key={post.id} style={{ padding: 18 }}>
          {post.image_url && <img src={post.image_url} alt="Official team update" style={{ display: "block", width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />}<p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p><small className="muted">{new Date(post.created_at).toLocaleString()}</small>
          <div style={{ marginTop: 12 }}><button className="btn dark" onClick={() => void remove(post)}>Delete update</button></div>
        </article>)}{!posts.length && <p className="muted">Your official FanFeed updates will appear here.</p>}</div>
      </section>
    </>}
  </div></main>;
}
