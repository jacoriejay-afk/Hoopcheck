"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FanBasketballSideSwitch from "../../components/FanBasketballSideSwitch";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import { PageShell } from "../../components/LayoutSystem";
import { FeedDiscoveryHeader, FeedPostCard, FeedAuthorRow, FeedMediaArea, FeedActionRow, FeedEmptyState, FeedStoryRing } from "../../components/HoopFeedShared";
import { hasActiveMembershipAtLeast } from "../../lib/membership-tier";
import TeamLogo from "../../components/TeamLogo";
import { useLanguage } from "../../components/LanguageProvider";
import "./fan-feed.css";
import "../hoopfeed-shared.css";
import { fanFeedI18n, fanFeedTeamComposerPlaceholder, fanFeedTeamEmptyTitle, fanFeedTeamEmptyBody, fanFeedRefreshLabel, fanFeedRefreshError, fanFeedExpiryLabel, fanFeedLoadError, fanFeedRemoveVideoLabel } from "./i18n";

type Team = { id: string; name: string; logo_url?: string | null; logo_bg?: "transparent" | "light" | "dark" | null };
type Profile = { id: string; display_name: string | null; avatar_url: string | null; account_type: string };
type FanPost = { id: string; author_id: string; team_id: string; womens_team_id?: string | null; team_href?: string; body: string; image_url: string | null; video_url?: string | null; created_at: string; expires_at: string; profiles?: Profile | null; teams?: Team | null; womens_teams?: Team | null; fan_feed_checks?: { user_id: string }[]; fan_feed_comments?: { id: string }[] };

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
  const [choosingClub, setChoosingClub] = useState(false);
  const [clubSearch, setClubSearch] = useState("");
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
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const loadSequence = useRef(0);
  const [membershipActive, setMembershipActive] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const basketballSide = useFanBasketballSide();
  const selectedTeam = teams.find(team => team.id === teamId) || null;
  const visiblePosts = posts; // Fan HQ is always a mixed feed of followed clubs.
  const teamComposerPlaceholder = selectedTeam
    ? fanFeedTeamComposerPlaceholder(selectedTeam.name, language)
    : ft("composerPlaceholder");

  const load = useCallback(async (uid: string) => {
    const requestId = ++loadSequence.current;
    const isCurrentRequest = () => requestId === loadSequence.current;
    const [{ data: follows }, { data: teamFollows }] = await Promise.all([
      supabase.from("follow_relationships").select("target_id,target_type").eq("follower_id", uid).eq("target_type", "fan"),
      supabase.from("follow_relationships").select("target_id,target_type").eq("follower_id", uid).eq("target_type", "team"),
    ]);
    if (!isCurrentRequest()) return;
    const fanIds = (follows || []).map((x: any) => x.target_id);
    const teamIds = (teamFollows || []).map((x: any) => x.target_id);
    const { data: sideTeams } = basketballSide === "womens"
      ? await supabase.from("womens_teams").select("id").eq("active", true)
      : await supabase.from("teams").select("id").eq("basketball_type", "mens").eq("active", true);
    if (!isCurrentRequest()) return;
    const sideTeamIds = new Set((sideTeams || []).map((x: any) => x.id));
    const scopedTeamIds = teamIds.filter((id: string) => sideTeamIds.has(id));
    setFollowing(new Set(fanIds));
    const teamQuery = basketballSide === "womens"
      ? await supabase.from("womens_teams").select("id,name,logo_url,logo_bg").in("id", scopedTeamIds.length ? scopedTeamIds : ["00000000-0000-0000-0000-000000000000"])
      : await supabase.from("teams").select("id,name,logo_url,logo_bg").in("id", scopedTeamIds.length ? scopedTeamIds : ["00000000-0000-0000-0000-000000000000"]);
    if (!isCurrentRequest()) return;
    const followedTeams = (teamQuery.data || []) as Team[];
    setTeams(followedTeams);
    setTeamId(current => followedTeams.some(team => team.id === current) ? current : "");
    if (!scopedTeamIds.length) { setPosts([]); setComments({}); setLiked(new Set()); return; }
    const query = supabase.from("fan_feed_posts")
      .select("id,author_id,team_id,womens_team_id,body,image_url,video_url,created_at,expires_at,profiles!fan_feed_posts_author_id_fkey(id,display_name,avatar_url,account_type),teams(id,name,logo_url,logo_bg),womens_teams(id,name,logo_url,logo_bg),fan_feed_checks(user_id),fan_feed_comments(id)")
      .in(basketballSide === "womens" ? "womens_team_id" : "team_id", scopedTeamIds)
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(100);
    const { data, error } = await query;
    if (!isCurrentRequest()) return;
    if (error) { setMessage(error.message); return; }
    const { data: archiveRows } = await supabase.from("fan_feed_archives").select("post_id").eq("user_id", uid);
    if (!isCurrentRequest()) return;
    const archivedIds = new Set((archiveRows || []).map((r: any) => r.post_id));
    setArchived(archivedIds);
    const rows = (data || []).filter((p: any) => {
      const targetTeamId = p.womens_team_id || p.team_id;
      return !archivedIds.has(p.id) && Boolean(targetTeamId) && sideTeamIds.has(targetTeamId) && scopedTeamIds.includes(targetTeamId);
    }).map((p: any) => {
      const mensTeam = Array.isArray(p.teams) ? p.teams[0] : p.teams;
      const womensTeam = Array.isArray(p.womens_teams) ? p.womens_teams[0] : p.womens_teams;
      const targetTeamId = p.womens_team_id || p.team_id;
      return { ...p, team_id: targetTeamId, team_href: p.womens_team_id ? `/womens/${targetTeamId}` : `/teams/${targetTeamId}`, checks: p.fan_feed_checks || [], profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles, teams: mensTeam || womensTeam };
    });
    setPosts(rows.map((p: any) => ({ ...p, checks: p.fan_feed_checks || [] })) as FanPost[]);
    setLiked(new Set(rows.filter((p: any) => (p.fan_feed_checks || []).some((l: any) => l.user_id === uid)).map((p: any) => p.id)));
    const ids = rows.map((p: any) => p.id);
    if (ids.length) {
      const { data: commentRows } = await supabase.from("fan_feed_comments").select("id,post_id,author_id,body,created_at,profiles(display_name,avatar_url)").in("post_id", ids).order("created_at", { ascending: true });
      if (!isCurrentRequest()) return;
      const grouped: Record<string, any[]> = {};
      (commentRows || []).forEach((c: any) => { (grouped[c.post_id] ||= []).push({ ...c, profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles }); });
      setComments(grouped);
    } else setComments({});
  }, [basketballSide]);

  useEffect(() => { setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  useEffect(() => () => { if (videoPreview) URL.revokeObjectURL(videoPreview); }, [videoPreview]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { if (alive) setLoading(false); return; }
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,avatar_url,account_type").eq("id", u.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,access_status").eq("user_id", u.id).maybeSingle(),
      ]);
      if (!alive) return;
      setUser(u); setProfile(p as Profile | null);
      const active = hasActiveMembershipAtLeast(s);
      if (p?.account_type !== "fan") { setLoading(false); return; }
      setMembershipActive(active);
      if (!active) { setLoading(false); return; }
      await load(u.id); if (alive) setLoading(false);
      } catch (error) {
        if (alive) {
          setMessage(error instanceof Error ? error.message : fanFeedLoadError(language));
          setLoading(false);
        }
      }
    })();
    return () => { alive = false; };
  }, [load, language]);

  async function refreshFeed() {
    if (!user || refreshing) return;
    setRefreshing(true);
    try {
      await load(user.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fanFeedRefreshError(language));
    } finally {
      setRefreshing(false);
    }
  }

  async function publish() {
    if (!user || profile?.account_type !== "fan" || !selectedTeam || (!body.trim() && !photo && !video) || posting) return;
    setPosting(true); setMessage(ft("moderating"));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData(); form.append("team_id", teamId); form.append("team_type", basketballSide); form.append("text", body.trim());
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

  if (loading) return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><HoopLoading label="Loading Fan HQ…" /></div></main></PageShell>;
  if (!user) return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><section className="hero-card"><h1>{ft("title")}</h1><p>{ft("signIn")}</p><Link className="btn" href="/login">{t("signIn")}</Link></section></div></main></PageShell>;
  if (profile?.account_type !== "fan") return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><section className="hero-card"><h1>{ft("fansOnly")}</h1></section></div></main></PageShell>;
  if (!membershipActive) return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><section className="hero-card"><h1>{ft("membershipRequired")}</h1><p>{ft("membershipDescription")}</p><Link className="btn" href="/membership">{t("membership")}</Link></section></div></main></PageShell>;
  return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page" onTouchStart={event => { touchStartY.current = window.scrollY === 0 ? (event.touches[0]?.clientY ?? null) : null; }} onTouchEnd={event => { const start = touchStartY.current; touchStartY.current = null; const end = event.changedTouches[0]?.clientY ?? 0; if (start !== null && end - start > 80 && user && !refreshing) void refreshFeed(); }}>
      <FanBasketballSideSwitch /><div className="page-container"><FeedDiscoveryHeader audience="fan" />
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/fans">{ft("discoverFans")}</Link><Link href="/team-hub">{ft("teamHub")}</Link><Link href="/teams">{ft("teams")}</Link></nav></header>
    <section className="hero-card hc-feed-hero"><div><p className="eyebrow">FAN HQ · CLUB COMMUNITIES</p><h1>Fan HQ</h1><p className="muted">Fan posts about the clubs you follow.</p></div><p className="hc-feed-expiry-note">Fans only<span>Posts expire after 24 hours · separate from player HoopFeed</span></p></section>

    <section className="dashboard-card hc-feed-composer" style={{ marginTop: 18 }}>
      <span className="card-kicker">{selectedTeam ? `Posting to ${selectedTeam.name} fans` : "Post to a followed club"}</span>
      {!selectedTeam && <button type="button" className="btn" onClick={() => setChoosingClub(true)}>Choose a followed club to post</button>}
      {selectedTeam && <button type="button" className="hc-feed-action-pill" onClick={() => { setTeamId(""); setChoosingClub(true); }}>Change club</button>}
      {choosingClub && <div className="hc-feed-club-picker"><label htmlFor="fan-club-search">Search clubs you follow</label><input id="fan-club-search" type="search" value={clubSearch} onChange={e => setClubSearch(e.target.value)} placeholder="Search followed clubs…" /><div role="list">{teams.filter(team => team.name.toLocaleLowerCase().includes(clubSearch.toLocaleLowerCase())).map(team => <button type="button" role="listitem" className="hc-feed-action-pill" key={team.id} onClick={() => { setTeamId(team.id); setChoosingClub(false); setClubSearch(""); }}>{team.name}</button>)}</div><button type="button" className="hc-feed-action-pill" onClick={() => setChoosingClub(false)}>Cancel</button></div>}
      {selectedTeam && <>
      <div className="hc-feed-composer__editor"><div className="hc-feed-composer__avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : "HC"}</div><textarea value={body} maxLength={500} rows={3} onChange={e => setBody(e.target.value)} placeholder={teamComposerPlaceholder} /></div>

      <div className="hc-feed-composer__footer"><label className="hc-feed-photo-button" htmlFor="fan-feed-photo">{ft("addPhoto")}</label><input id="fan-feed-photo" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (!f) return; if (f.size > 8 * 1024 * 1024 || !f.type.startsWith("image/")) { setMessage(ft("photoLimit")); return; } setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); setVideo(null); setVideoPreview(""); }} /><label className="hc-feed-photo-button" htmlFor="fan-feed-video">{ft("addVideo")}</label><input id="fan-feed-video" className="visually-hidden" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => { const f=e.target.files?.[0]; e.currentTarget.value = ""; if(!f)return; if(f.size>50*1024*1024 || !["video/mp4","video/webm","video/quicktime"].includes(f.type)){setMessage(ft("videoLimit"));return;} setVideo(f);setVideoPreview(URL.createObjectURL(f));setPhoto(null);setPhotoPreview(""); }} /><span className="hc-feed-counter">{body.length}/500</span><button className="btn hc-feed-post-button" disabled={posting || !teamId || (!body.trim() && !photo && !video)} onClick={() => void publish()}>{posting ? ft("posting") : ft("post")}</button></div>
      {photoPreview && <div style={{ marginTop: 12 }}><img src={photoPreview} alt={ft("photoPreview")} style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 16 }} /><button type="button" className="btn dark" onClick={() => { setPhoto(null); setPhotoPreview(""); }}>{ft("removePhoto")}</button></div>}
      {videoPreview && <div style={{ marginTop: 12 }}><video src={videoPreview} controls playsInline preload="metadata" style={{ width: "100%", maxHeight: 360, borderRadius: 16 }} aria-label={ft("addVideo")} /><button type="button" className="btn dark" onClick={() => { setVideo(null); setVideoPreview(""); }}>{fanFeedRemoveVideoLabel(language)}</button></div>}
      {message && <p className="hc-feed-message" role="status">{message}</p>}
      </>}
      {!teams.length && <p className="muted">{ft("followTeamFirst")} <Link href="/teams">{ft("teams")}</Link></p>}
    </section>
    <div className="hc-feed-refresh-row"><button type="button" className="hc-feed-refresh" disabled={refreshing} onClick={() => void refreshFeed()}>{fanFeedRefreshLabel(language, refreshing)}</button></div>
    <section className="hc-feed-stream" aria-label={ft("recentPosts")}>{visiblePosts.length ? visiblePosts.map(post => <FeedPostCard key={post.id}>
      <header className="hc-feed-post-header"><FeedAuthorRow><Link href={"/fans/" + post.author_id} aria-label={ft("viewFanProfile")}><FeedStoryRing expiresAt={post.expires_at} now={now}>{post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" className="hc-feed-post-avatar" /> : <div className="hc-feed-post-avatar hc-feed-post-avatar-fallback">HC</div>}</FeedStoryRing></Link><div className="hc-feed-post-author__meta"><Link href={"/fans/" + post.author_id}><strong>{post.profiles?.display_name || ft("fan")}</strong></Link><small>{formatDate(post.created_at, { dateStyle: "medium", timeStyle: "short" })} · {fanFeedExpiryLabel(post.expires_at, now, language)}</small></div></FeedAuthorRow>{post.teams && <Link className="hc-feed-post-topic" href={post.team_href || (basketballSide === "womens" ? "/womens/" : "/teams/") + post.team_id}><TeamLogo name={post.teams.name} logoUrl={post.teams.logo_url} logoBg={post.teams.logo_bg} size={28} />{post.teams.name} · Fan post</Link>}</header>
      <FeedMediaArea>{post.body.trim() && <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>}{post.image_url && <img src={post.image_url} alt={ft("postPhoto")} className="hc-feed-post-image" />}{post.video_url && <video src={post.video_url} controls playsInline preload="metadata" className="hc-feed-post-image" aria-label={ft("videoPostLabel")} />}</FeedMediaArea>
      <FeedActionRow><button type="button" className={"hc-feed-action-pill" + (liked.has(post.id) ? " is-active" : "")} onClick={() => void toggleCheck(post)}>{liked.has(post.id) ? "✓ " + ft("checked") : "＋ " + ft("check")} · {(post.fan_feed_checks || []).length}</button><button type="button" className="hc-feed-action-pill" onClick={() => setOpenComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}>{ft("comment")} · {(comments[post.id] || []).length}</button><button type="button" className="hc-feed-action-pill" onClick={() => void sharePost(post)}>{ft("share")}</button>{post.author_id === user.id && <><button type="button" className="hc-feed-action-pill" onClick={() => void archivePost(post)}>{ft("archive")}</button><button type="button" className="hc-feed-action-pill" onClick={() => void deletePost(post)}>{ft("delete")}</button></>}<span className="hc-feed-expires">{ft("expires")} {formatDate(post.expires_at, { timeStyle: "short" })}</span></FeedActionRow>
      {openComments[post.id] && <div className="hc-feed-comments-panel"><strong>{ft("comments")}</strong>{(comments[post.id] || []).map(c => <div key={c.id}><strong>{c.profiles?.display_name || ft("fan")}</strong><p>{c.body}</p></div>)}<div className="hc-feed-composer__footer"><input value={drafts[post.id] || ""} maxLength={500} onChange={e => setDrafts(prev => ({ ...prev, [post.id]: e.target.value }))} placeholder={ft("commentPlaceholder")} /><button className="btn" onClick={() => void addComment(post.id)}>{ft("send")}</button></div></div>}
      <footer><button type="button" className="hc-feed-action-pill" disabled={post.author_id === user.id || following.has(post.author_id)} onClick={() => void followFan(post.author_id)}>{following.has(post.author_id) ? ft("following") : ft("followFan")}</button></footer>
    </FeedPostCard>) : <FeedEmptyState><span className="eyebrow">{ft("emptyKicker")}</span><h2>No fan posts yet</h2><p className="muted">{teams.length ? "No recent posts from your followed clubs. Start the conversation by posting to one of them." : "Follow a club to see its fan posts here."}</p>{selectedTeam ? <button className="btn" type="button" onClick={() => document.querySelector<HTMLTextAreaElement>(".hc-feed-composer textarea")?.focus()}>Post to {selectedTeam.name} fans</button> : teams.length ? <button className="btn" type="button" onClick={() => setChoosingClub(true)}>Post to a followed club</button> : <Link className="btn" href="/search">Find clubs to follow</Link>}</FeedEmptyState>}</section>
  </div></main></PageShell>;
}
