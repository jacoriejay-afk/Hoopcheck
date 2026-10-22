"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import { useLanguage } from "../../components/LanguageProvider";
import "./fan-feed.css";

type Team = { id: string; name: string; logo_url?: string | null };
type Profile = { id: string; display_name: string | null; avatar_url: string | null; account_type: string };
type FanPost = { id: string; author_id: string; team_id: string; body: string; image_url: string | null; created_at: string; expires_at: string; profiles?: Profile | null; teams?: Team | null; fan_feed_likes?: { user_id: string }[]; fan_feed_comments?: { id: string }[] };

export default function FanFeedPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [posts, setPosts] = useState<FanPost[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [teamId, setTeamId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [membershipActive, setMembershipActive] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (uid: string) => {
    const [{ data: follows }, { data: teamFollows }] = await Promise.all([
      supabase.from("follow_relationships").select("target_id,target_type").eq("follower_id", uid).eq("target_type", "fan"),
      supabase.from("follow_relationships").select("target_id,target_type").eq("follower_id", uid).eq("target_type", "team"),
    ]);
    const fanIds = (follows || []).map((x: any) => x.target_id);
    const teamIds = (teamFollows || []).map((x: any) => x.target_id);
    setFollowing(new Set(fanIds));
    const teamQuery = await supabase.from("teams").select("id,name,logo_url").in("id", teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"]);
    const followedTeams = (teamQuery.data || []) as Team[];
    setTeams(followedTeams);
    if (!teamId && followedTeams.length) setTeamId(followedTeams[0].id);
    if (!fanIds.length && !teamIds.length) { setPosts([]); return; }
    const query = supabase.from("fan_feed_posts")
      .select("id,author_id,team_id,body,image_url,created_at,expires_at,profiles!fan_feed_posts_author_id_fkey(id,display_name,avatar_url,account_type),teams(id,name,logo_url),fan_feed_likes(user_id),fan_feed_comments(id)")
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(100);
    const { data, error } = await query;
    if (error) { setMessage(error.message); return; }
    const rows = (data || []).filter((p: any) => fanIds.includes(p.author_id) || teamIds.includes(p.team_id))
      .map((p: any) => ({ ...p, likes: p.fan_feed_likes || [], profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles, teams: Array.isArray(p.teams) ? p.teams[0] : p.teams }));
    setPosts(rows as FanPost[]);
    setLiked(new Set(rows.filter((p: any) => (p.fan_feed_likes || []).some((l: any) => l.user_id === uid)).map((p: any) => p.id)));
    const ids = rows.map((p: any) => p.id);
    if (ids.length) {
      const { data: commentRows } = await supabase.from("fan_feed_comments").select("id,post_id,author_id,body,created_at,profiles(display_name,avatar_url)").in("post_id", ids).order("created_at", { ascending: true });
      const grouped: Record<string, any[]> = {};
      (commentRows || []).forEach((c: any) => { (grouped[c.post_id] ||= []).push({ ...c, profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles }); });
      setComments(grouped);
    } else setComments({});
  }, [teamId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { if (alive) setLoading(false); return; }
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,avatar_url,account_type").eq("id", u.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,access_status").eq("user_id", u.id).maybeSingle(),
      ]);
      if (!alive) return;
      setUser(u); setProfile(p as Profile | null);
      const active = ["pro", "premium"].includes(s?.plan || "") && ["active", "trialing"].includes(s?.status || "") && ["active", "trialing", "pro", "premium"].includes(s?.access_status ?? "active");
      if (p?.account_type !== "fan") { setLoading(false); return; }
      setMembershipActive(active);
      if (!active) { setLoading(false); return; }
      await load(u.id); if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [load]);

  async function publish() {
    if (!user || profile?.account_type !== "fan" || !teamId || (!body.trim() && !photo) || posting) return;
    setPosting(true); setMessage(t("fanFeed.moderating"));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData(); form.append("team_id", teamId); form.append("text", body.trim());
      if (photo) form.append("image", photo);
      const response = await fetch("/api/fan-feed/moderate", { method: "POST", headers: { Authorization: "Bearer " + session?.access_token }, body: form });
      const result = await response.json();
      if (!response.ok || result.allowed !== true) throw new Error(result.message || t("fanFeed.publishFailed"));
      setBody(""); setPhoto(null); setPhotoPreview(""); setMessage(t("fanFeed.published"));
      await load(user.id);
    } catch (e: any) { setMessage(e?.message || t("fanFeed.publishFailed")); }
    finally { setPosting(false); }
  }

  async function toggleLike(post: FanPost) {
    if (!user) return;
    if (liked.has(post.id)) {
      const { error } = await supabase.from("fan_feed_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      if (error) { setMessage(error.message); return; }
      setLiked(prev => { const next = new Set(prev); next.delete(post.id); return next; });
    } else {
      const { error } = await supabase.from("fan_feed_likes").insert({ post_id: post.id, user_id: user.id });
      if (error) { setMessage(error.message); return; }
      setLiked(prev => new Set(prev).add(post.id));
    }
  }

  async function addComment(postId: string) {
    const text = (drafts[postId] || "").trim();
    if (!user || !text) return;
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch("/api/fan-feed/moderate", { method: "POST", headers: { Authorization: "Bearer " + session?.access_token, "Content-Type": "application/json" }, body: JSON.stringify({ kind: "comment", post_id: postId, text }) });
    const result = await response.json();
    if (!response.ok || !result.allowed) { setMessage(result.message || t("fanFeed.commentFailed")); return; }
    setDrafts(prev => ({ ...prev, [postId]: "" }));
    await load(user.id);
  }

  async function followFan(targetId: string) {
    if (!user || targetId === user.id) return;
    const { error } = await supabase.from("follow_relationships").upsert({ follower_id: user.id, target_id: targetId, target_type: "fan" }, { onConflict: "follower_id,target_type,target_id" });
    if (error) setMessage(error.message);
    else { setFollowing(prev => new Set(prev).add(targetId)); setMessage(t("fanFeed.following")); }
  }

  if (loading) return <main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><HoopLoading label={t("fanFeed.loading")} /></div></main>;
  if (!user) return <main className="page-shell hc-feed-page"><div className="page-container"><section className="hero-card"><h1>{t("fanFeed.title")}</h1><p>{t("fanFeed.signIn")}</p><Link className="btn" href="/login">{t("signIn")}</Link></section></div></main>;
  if (profile?.account_type !== "fan") return <main className="page-shell hc-feed-page"><div className="page-container"><section className="hero-card"><h1>{t("fanFeed.fansOnly")}</h1><p>{t("fanFeed.separateSurface")}</p><Link className="btn" href="/feed">{t("fanFeed.playerFeed")}</Link></section></div></main>;
  if (!membershipActive) return <main className="page-shell hc-feed-page"><div className="page-container"><section className="hero-card"><p className="eyebrow">FAN HQ</p><h1>{t("fanFeed.title")}</h1><p className="muted">{t("membershipRequired")}</p><Link className="btn" href="/membership">{t("membership")}</Link></section></div></main>;
  return <main className="page-shell hc-feed-page"><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/fans">{t("fanFeed.discoverFans")}</Link><Link href="/teams">{t("fanFeed.teams")}</Link></nav></header>
    <section className="hero-card hc-feed-hero"><div><p className="eyebrow">{t("fanFeed.kicker")}</p><h1>{t("fanFeed.title")}</h1><p className="muted">{t("fanFeed.subtitle")}</p></div><p className="hc-feed-expiry-note">{t("fanFeed.teamFirst")}<span>{t("fanFeed.fanOnlyNote")}</span></p></section>
    <section className="dashboard-card hc-feed-composer" style={{ marginTop: 18 }}>
      <span className="card-kicker">{t("fanFeed.postForTeam")}</span>
      <div className="hc-feed-composer__editor"><div className="hc-feed-composer__avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : "HC"}</div><textarea value={body} maxLength={500} rows={3} onChange={e => setBody(e.target.value)} placeholder={t("fanFeed.composerPlaceholder")} /></div>
      <label className="hc-feed-topic-label" htmlFor="fan-team-select">{t("fanFeed.chooseTeam")}</label>
      <select id="fan-team-select" value={teamId} onChange={e => setTeamId(e.target.value)} className="hc-feed-team-select" required><option value="">{t("fanFeed.selectTeam")}</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
      <div className="hc-feed-composer__footer"><label className="hc-feed-photo-button" htmlFor="fan-feed-photo">{t("fanFeed.addPhoto")}</label><input id="fan-feed-photo" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 8 * 1024 * 1024 || !f.type.startsWith("image/")) { setMessage(t("fanFeed.photoLimit")); return; } setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }} /><span className="hc-feed-counter">{body.length}/500</span><button className="btn hc-feed-post-button" disabled={posting || !teamId || (!body.trim() && !photo)} onClick={() => void publish()}>{posting ? t("fanFeed.posting") : t("fanFeed.post")}</button></div>
      {photoPreview && <div style={{ marginTop: 12 }}><img src={photoPreview} alt={t("fanFeed.photoPreview")} style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 16 }} /><button type="button" className="btn dark" onClick={() => { setPhoto(null); setPhotoPreview(""); }}>{t("fanFeed.removePhoto")}</button></div>}
      {message && <p className="hc-feed-message" role="status">{message}</p>}
      {!teams.length && <p className="muted">{t("fanFeed.followTeamFirst")} <Link href="/teams">{t("fanFeed.teams")}</Link></p>}
    </section>
    <section className="hc-feed-stream" aria-label={t("fanFeed.recentPosts")}>{posts.length ? posts.map(post => <article key={post.id} className="dashboard-card hc-feed-ticket">
      <header className="hc-feed-post-header"><div className="hc-feed-post-author"><Link href={"/fans/" + post.author_id} aria-label={t("fanFeed.fan")}>{post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" className="hc-feed-post-avatar" /> : <div className="player-avatar-fallback hc-feed-post-avatar">HC</div>}</Link><div className="hc-feed-post-author__meta"><Link href={"/fans/" + post.author_id}><strong>{post.profiles?.display_name || t("fanFeed.fan")}</strong></Link><small>{new Date(post.created_at).toLocaleString()}</small></div></div>{post.teams && <Link className="hc-feed-post-topic" href={"/teams/" + post.team_id}>{post.teams.name}</Link>}</header>
      {post.body.trim() && <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>}{post.image_url && <img src={post.image_url} alt={t("fanFeed.postPhoto")} className="hc-feed-post-image" />}
      <div className="hc-feed-post-actions"><button type="button" className={"hc-feed-action-pill" + (liked.has(post.id) ? " is-active" : "")} onClick={() => void toggleLike(post)}>{liked.has(post.id) ? "♥" : "♡"} {t("fanFeed.like")} · {(post.fan_feed_likes || []).length + (liked.has(post.id) ? 1 : 0) - ((post.fan_feed_likes || []).some((l: any) => l.user_id === user.id) && !liked.has(post.id) ? 1 : 0)}</button><button type="button" className="hc-feed-action-pill" onClick={() => setOpenComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}>{t("fanFeed.comment")} · {(comments[post.id] || []).length}</button><span className="hc-feed-expires">{t("fanFeed.expires")} {new Date(post.expires_at).toLocaleTimeString()}</span></div>
      {openComments[post.id] && <div className="hc-feed-comments-panel"><strong>{t("fanFeed.comments")}</strong>{(comments[post.id] || []).map(c => <div key={c.id}><strong>{c.profiles?.display_name || t("fanFeed.fan")}</strong><p>{c.body}</p></div>)}<div className="hc-feed-composer__footer"><input value={drafts[post.id] || ""} maxLength={500} onChange={e => setDrafts(prev => ({ ...prev, [post.id]: e.target.value }))} placeholder={t("fanFeed.commentPlaceholder")} /><button className="btn" onClick={() => void addComment(post.id)}>{t("fanFeed.send")}</button></div></div>}
      <footer><button type="button" className="hc-feed-action-pill" disabled={post.author_id === user.id || following.has(post.author_id)} onClick={() => void followFan(post.author_id)}>{following.has(post.author_id) ? t("fanFeed.following") : t("fanFeed.followFan")}</button></footer>
    </article>) : <div className="dashboard-card hc-feed-empty"><span className="eyebrow">{t("fanFeed.emptyKicker")}</span><h2>{t("fanFeed.emptyTitle")}</h2><p className="muted">{t("fanFeed.emptyBody")}</p><Link className="btn" href="/fans">{t("fanFeed.discoverFans")}</Link></div>}</section>
  </div></main>;
}
