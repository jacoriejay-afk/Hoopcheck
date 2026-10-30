"use client";

import { useCallback, useEffect, useState } from "react";
import FanBasketballSideSwitch from "../../components/FanBasketballSideSwitch";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import TeamLogo from "../../components/TeamLogo";
import TeamOfficialUpdates from "../../components/TeamOfficialUpdates";
import HoopLoading from "../../components/HoopLoading";
import { useLanguage } from "../../components/LanguageProvider";
import "./fan-feed.css";
import { fanFeedI18n } from "./i18n";

type Team = { id: string; name: string; logo_url?: string | null; logo_bg?: "transparent" | "light" | "dark" | null };
type Profile = { id: string; display_name: string | null; avatar_url: string | null; account_type: string };
type FanPost = { id: string; author_id: string; team_id: string; body: string; image_url: string | null; video_url?: string | null; created_at: string; expires_at: string; profiles?: Profile | null; teams?: Team | null; fan_feed_checks?: { user_id: string }[]; fan_feed_comments?: { id: string }[] };

export default function FanFeedPage() {
  const { t, language, formatDate } = useLanguage();
  const ft = (key: Parameters<typeof fanFeedI18n>[0]) => {
    const sharedTranslation = t(key);
    return fanFeedI18n(key, language, sharedTranslation === key ? undefined : sharedTranslation);
  };
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [posts, setPosts] = useState<FanPost[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [body, setBody] = useState("");
  const [teamId, setTeamId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [membershipActive, setMembershipActive] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const basketballSide = useFanBasketballSide();

  const load = useCallback(async (uid: string) => {
    const [{ data: follows }, { data: teamFollows }] = await Promise.all([
      supabase.from("follow_relationships").select("target_id,target_type").eq("follower_id", uid).eq("target_type", "fan"),
      supabase.from("follow_relationships").select("target_id,target_type").eq("follower_id", uid).eq("target_type", "team"),
    ]);
    const fanIds = (follows || []).map((x: any) => x.target_id);
    const teamIds = (teamFollows || []).map((x: any) => x.target_id);
    const { data: sideTeams } = await supabase.from("teams").select("id").eq("basketball_type", basketballSide === "womens" ? "womens" : "mens");
    const sideTeamIds = new Set((sideTeams || []).map((x: any) => x.id));
    const scopedTeamIds = teamIds.filter((id: string) => sideTeamIds.has(id));
    setFollowing(new Set(fanIds));
    const teamQuery = await supabase.from("teams").select("id,name,logo_url,logo_bg").in("id", scopedTeamIds.length ? scopedTeamIds : ["00000000-0000-0000-0000-000000000000"]);
    const followedTeams = (teamQuery.data || []) as Team[];
    setTeams(followedTeams);
    setTeamId(current => followedTeams.some(team => team.id === current) ? current : followedTeams[0]?.id || "");
    if (!fanIds.length && !sideTeamIds.size) { setPosts([]); return; }
    const query = supabase.from("fan_feed_posts")
      .select("id,author_id,team_id,body,image_url,video_url,created_at,expires_at,profiles!fan_feed_posts_author_id_fkey(id,display_name,avatar_url,account_type),teams(id,name,logo_url,logo_bg),fan_feed_checks(user_id),fan_feed_comments(id)")
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(100);
    const { data, error } = await query;
    if (error) { setMessage(error.message); return; }
    const { data: archiveRows } = await supabase.from("fan_feed_archives").select("post_id").eq("user_id", uid);
    const archivedIds = new Set((archiveRows || []).map((r: any) => r.post_id));
    setArchived(archivedIds);
    const rows = (data || []).filter((p: any) => !archivedIds.has(p.id) && sideTeamIds.has(p.team_id) && (fanIds.includes(p.author_id) || scopedTeamIds.includes(p.team_id)))
      .map((p: any) => ({ ...p, checks: p.fan_feed_checks || [], profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles, teams: Array.isArray(p.teams) ? p.teams[0] : p.teams }));
    setPosts(rows.map((p: any) => ({ ...p, checks: p.fan_feed_checks || [] })) as FanPost[]);
    setLiked(new Set(rows.filter((p: any) => (p.fan_feed_checks || []).some((l: any) => l.user_id === uid)).map((p: any) => p.id)));
    const ids = rows.map((p: any) => p.id);
    if (ids.length) {
      const { data: commentRows } = await supabase.from("fan_feed_comments").select("id,post_id,author_id,body,created_at,profiles(display_name,avatar_url)").in("post_id", ids).order("created_at", { ascending: true });
      const grouped: Record<string, any[]> = {};
      (commentRows || []).forEach((c: any) => { (grouped[c.post_id] ||= []).push({ ...c, profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles }); });
      setComments(grouped);
    } else setComments({});
  }, [basketballSide]);

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
    if (!user || profile?.account_type !== "fan" || !teamId || (!body.trim() && !photo && !video) || posting) return;
    setPosting(true); setMessage(ft("moderating"));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData(); form.append("team_id", teamId); form.append("text", body.trim());
      if (photo) form.append("image", photo);
      if (video) {
        const ext = video.type === "video/webm" ? "webm" : video.type === "video/quicktime" ? "mov" : "mp4";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("feed-videos").upload(path, video, { contentType: video.type, cacheControl: "31536000", upsert: false });
        if (uploadError) throw new Error("Video upload failed. Please try again.");
        form.append("video_path", path); form.append("video_type", video.type);
      }
      const response = await fetch("/api/fan-feed/moderate", { method: "POST", headers: { Authorization: "Bearer " + session?.access_token }, body: form });
      const result = await response.json();
      if (!response.ok || result.allowed !== true) throw new Error(result.message || ft("publishFailed"));
      setBody(""); setPhoto(null); setPhotoPreview(""); setVideo(null); setVideoPreview(""); setMessage(ft("published"));
      await load(user.id);
    } catch (e: any) { setMessage(e?.message || ft("publishFailed")); }
    finally { setPosting(false); }
  }

  async function toggleCheck(post: FanPost) {
    if (!user) return;
    if (liked.has(post.id)) {
      const { error } = await supabase.from("fan_feed_checks").delete().eq("post_id", post.id).eq("user_id", user.id);
      if (error) { setMessage(error.message); return; }
      setLiked(prev => { const next = new Set(prev); next.delete(post.id); return next; });
    } else {
      // Idempotent write: repeated taps or stale feed state must not surface a
      // duplicate-key error for the (post_id, user_id) primary key.
      const { error } = await supabase.from("fan_feed_checks")
        .upsert({ post_id: post.id, user_id: user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
      if (error) { setMessage(error.message); return; }
      setLiked(prev => new Set(prev).add(post.id));
    }
  }

  async function archivePost(post: FanPost) {
    if (!user || post.author_id !== user.id) return;
    const { error } = await supabase.from("fan_feed_archives").upsert({ user_id: user.id, post_id: post.id }, { onConflict: "user_id,post_id" });
    if (error) { setMessage(error.message); return; }
    setArchived(prev => new Set(prev).add(post.id));
    setPosts(prev => prev.filter(p => p.id !== post.id));
    setMessage(ft("archiveSuccess"));
  }

  async function deletePost(post: FanPost) {
    if (!user || post.author_id !== user.id || !window.confirm(ft("deleteConfirm"))) return;
    const { error } = await supabase.from("fan_feed_posts").delete().eq("id", post.id).eq("author_id", user.id);
    if (error) { setMessage(error.message); return; }
    setPosts(prev => prev.filter(p => p.id !== post.id));
    setMessage(ft("deleteSuccess"));
  }

  async function sharePost(post: FanPost) {
    const url = `${window.location.origin}/fan-feed?post=${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: ft("shareTitle"), text: post.body.slice(0, 160), url });
      else { await navigator.clipboard.writeText(url); setMessage(ft("linkCopied")); }
    } catch (error: any) { if (error?.name !== "AbortError") setMessage(ft("shareFailed")); }
  }

  async function addComment(postId: string) {
    const text = (drafts[postId] || "").trim();
    if (!user || !text) return;
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch("/api/fan-feed/moderate", { method: "POST", headers: { Authorization: "Bearer " + session?.access_token, "Content-Type": "application/json" }, body: JSON.stringify({ kind: "comment", post_id: postId, text }) });
    const result = await response.json();
    if (!response.ok || !result.allowed) { setMessage(result.message || ft("commentFailed")); return; }
    setDrafts(prev => ({ ...prev, [postId]: "" }));
    await load(user.id);
  }

  async function followFan(targetId: string) {
    if (!user || targetId === user.id) return;
    const { error } = await supabase.from("follow_relationships").upsert({ follower_id: user.id, target_id: targetId, target_type: "fan" }, { onConflict: "follower_id,target_type,target_id" });
    if (error) setMessage(error.message);
    else { setFollowing(prev => new Set(prev).add(targetId)); setMessage(ft("following")); }
  }

  if (loading) return <main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><HoopLoading label={ft("loading")} /></div></main>;
  if (!user) return <main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><section className="hero-card"><h1>{ft("title")}</h1><p>{ft("signIn")}</p><Link className="btn" href="/login">{t("signIn")}</Link></section></div></main>;
  if (profile?.account_type !== "fan") return <main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><section className="hero-card"><h1>{ft("fansOnly")}</h1><p>{ft("separateSurface")}</p><Link className="btn" href="/login">{ft("playerFeed")}</Link></section></div></main>;
  if (!membershipActive) return <main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><section className="hero-card"><h1>{ft("membershipRequired")}</h1><p>{ft("membershipDescription")}</p><Link className="btn" href="/membership">{t("membership")}</Link></section></div></main>;
  return <main className="page-shell hc-feed-page hc-fan-feed-page">
      <FanBasketballSideSwitch /><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/fans">{ft("discoverFans")}</Link><Link href="/team-hub">{ft("teamHub")}</Link><Link href="/teams">{ft("teams")}</Link></nav></header>
    <section className="hero-card hc-feed-hero"><div><p className="eyebrow">{ft("kicker")}</p><h1>{ft("title")}</h1><p className="muted">{ft("subtitle")}</p></div><p className="hc-feed-expiry-note">{ft("teamFirst")}<span>{ft("fanOnlyNote")}</span></p></section>
    <TeamOfficialUpdates />
    <section className="dashboard-card hc-feed-composer" style={{ marginTop: 18 }}>
      <span className="card-kicker">{ft("postForTeam")}</span>
      <div className="hc-feed-composer__editor"><div className="hc-feed-composer__avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : "HC"}</div><textarea value={body} maxLength={500} rows={3} onChange={e => setBody(e.target.value)} placeholder={ft("composerPlaceholder")} /></div>
      <label className="hc-feed-topic-label" htmlFor="fan-team-select">{ft("chooseTeam")}</label>
      <select id="fan-team-select" value={teamId} onChange={e => setTeamId(e.target.value)} className="hc-feed-team-select" required><option value="">{ft("selectTeam")}</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
      <div className="hc-feed-composer__footer"><label className="hc-feed-photo-button" htmlFor="fan-feed-photo">{ft("addPhoto")}</label><input id="fan-feed-photo" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 8 * 1024 * 1024 || !f.type.startsWith("image/")) { setMessage(ft("photoLimit")); return; } setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); setVideo(null); setVideoPreview(""); }} /><label className="hc-feed-photo-button" htmlFor="fan-feed-video">{ft("addVideo")}</label><input id="fan-feed-video" className="visually-hidden" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => { const f=e.target.files?.[0]; if(!f)return; if(f.size>50*1024*1024 || !["video/mp4","video/webm","video/quicktime"].includes(f.type)){setMessage(ft("videoLimit"));return;} setVideo(f);setVideoPreview(URL.createObjectURL(f));setPhoto(null);setPhotoPreview(""); }} /><span className="hc-feed-counter">{body.length}/500</span><button className="btn hc-feed-post-button" disabled={posting || !teamId || (!body.trim() && !photo && !video)} onClick={() => void publish()}>{posting ? ft("posting") : ft("post")}</button></div>
      {photoPreview && <div style={{ marginTop: 12 }}><img src={photoPreview} alt={ft("photoPreview")} style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 16 }} /><button type="button" className="btn dark" onClick={() => { setPhoto(null); setPhotoPreview(""); }}>{ft("removePhoto")}</button></div>}
      {videoPreview && <div style={{ marginTop: 12 }}><video src={videoPreview} controls playsInline preload="metadata" style={{ width: "100%", maxHeight: 360, borderRadius: 16 }} aria-label={ft("addVideo")} /><button type="button" className="btn dark" onClick={() => { setVideo(null); setVideoPreview(""); }}>{ft("removePhoto")}</button></div>}
      {message && <p className="hc-feed-message" role="status">{message}</p>}
      {!teams.length && <p className="muted">{ft("followTeamFirst")} <Link href="/teams">{ft("teams")}</Link></p>}
    </section>
    <section className="hc-feed-stream" aria-label={ft("recentPosts")}>{posts.length ? posts.map(post => <article key={post.id} className="dashboard-card hc-feed-ticket">
      <header className="hc-feed-post-header"><div className="hc-feed-post-author"><Link href={"/fans/" + post.author_id} aria-label={ft("viewFanProfile")}>{post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" className="hc-feed-post-avatar" /> : <div className="player-avatar-fallback hc-feed-post-avatar">HC</div>}</Link><div className="hc-feed-post-author__meta"><Link href={"/fans/" + post.author_id}><strong>{post.profiles?.display_name || ft("fan")}</strong></Link><small>{formatDate(post.created_at, { dateStyle: "medium", timeStyle: "short" })}</small></div></div>{post.teams && <Link className="hc-feed-post-topic" href={"/teams/" + post.team_id}><TeamLogo name={post.teams.name} logoUrl={post.teams.logo_url} logoBg={post.teams.logo_bg} size={28} />{post.teams.name}</Link>}</header>
      {post.body.trim() && <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>}{post.image_url && <img src={post.image_url} alt={ft("postPhoto")} className="hc-feed-post-image" />}{post.video_url && <video src={post.video_url} controls playsInline preload="metadata" className="hc-feed-post-image" aria-label={ft("videoPostLabel")} />}
      <div className="hc-feed-post-actions"><button type="button" className={"hc-feed-action-pill" + (liked.has(post.id) ? " is-active" : "")} onClick={() => void toggleCheck(post)}>{liked.has(post.id) ? "✓ " + ft("checked") : "＋ " + ft("check")} · {(post.fan_feed_checks || []).length}</button><button type="button" className="hc-feed-action-pill" onClick={() => setOpenComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}>{ft("comment")} · {(comments[post.id] || []).length}</button><button type="button" className="hc-feed-action-pill" onClick={() => void sharePost(post)}>{ft("share")}</button>{post.author_id === user.id && <><button type="button" className="hc-feed-action-pill" onClick={() => void archivePost(post)}>{ft("archive")}</button><button type="button" className="hc-feed-action-pill" onClick={() => void deletePost(post)}>{ft("delete")}</button></>}<span className="hc-feed-expires">{ft("expires")} {new Date(post.expires_at).toLocaleTimeString()}</span></div>
      {openComments[post.id] && <div className="hc-feed-comments-panel"><strong>{ft("comments")}</strong>{(comments[post.id] || []).map(c => <div key={c.id}><strong>{c.profiles?.display_name || ft("fan")}</strong><p>{c.body}</p></div>)}<div className="hc-feed-composer__footer"><input value={drafts[post.id] || ""} maxLength={500} onChange={e => setDrafts(prev => ({ ...prev, [post.id]: e.target.value }))} placeholder={ft("commentPlaceholder")} /><button className="btn" onClick={() => void addComment(post.id)}>{ft("send")}</button></div></div>}
      <footer><button type="button" className="hc-feed-action-pill" disabled={post.author_id === user.id || following.has(post.author_id)} onClick={() => void followFan(post.author_id)}>{following.has(post.author_id) ? ft("following") : ft("followFan")}</button></footer>
    </article>) : <div className="dashboard-card hc-feed-empty"><span className="eyebrow">{ft("emptyKicker")}</span><h2>{ft("emptyTitle")}</h2><p className="muted">{ft("emptyBody")}</p><Link className="btn" href="/fans">{ft("discoverFans")}</Link></div>}</section>
  </div></main>;
}
