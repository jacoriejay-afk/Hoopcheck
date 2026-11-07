"use client";

import { useCallback, useEffect, useState } from "react";
import FanBasketballSideSwitch from "../../components/FanBasketballSideSwitch";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { PageShell } from "../../components/LayoutSystem";
import { FeedPostCard, FeedAuthorRow, FeedMediaArea, FeedActionRow, FeedEmptyState, FeedLoadingSkeleton } from "../../components/HoopFeedShared";
import { getHoopCheckEntitlements } from "../../lib/membership-tier";
import TeamLogo from "../../components/TeamLogo";
import { useLanguage } from "../../components/LanguageProvider";
import "./fan-feed.css";
import "../hoopfeed-shared.css";
import { fanFeedI18n, fanFeedTeamComposerPlaceholder } from "./i18n";

type Team = { id: string; name: string; logo_url?: string | null; logo_bg?: "transparent" | "light" | "dark" | null; group_name?: string | null; is_member?: boolean };
type Profile = { id: string; display_name: string | null; avatar_url: string | null; account_type: string };
type FanPost = { id: string; author_id: string; team_id: string; body: string; image_url: string | null; image_src?: string | null; is_pinned: boolean; created_at: string; profiles?: Profile | null; teams?: Team | null };
type GroupComment = { id: string; post_id: string; author_id: string; body: string; created_at: string; profiles?: { display_name: string | null; avatar_url?: string | null } | null };

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
  const [composerOpen, setComposerOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [comments, setComments] = useState<Record<string, GroupComment[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [membershipActive, setMembershipActive] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const basketballSide = useFanBasketballSide();
  const selectedTeam = teams.find(team => team.id === teamId) || null;
  const filteredTeams = teams.filter(team => team.name.toLowerCase().includes(teamSearch.trim().toLowerCase()));
  const teamComposerPlaceholder = selectedTeam ? fanFeedTeamComposerPlaceholder(selectedTeam.name, language) : ft("composerPlaceholder");

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
    const { data: groupRows } = scopedTeamIds.length ? await supabase.from("team_fan_groups").select("team_id,group_name").in("team_id", scopedTeamIds) : { data: [] as { team_id: string; group_name: string }[] };
    const groupNames = new Map((groupRows || []).map((group: any) => [group.team_id, group.group_name]));
    const { data: memberRows } = scopedTeamIds.length
      ? await supabase.from("team_fan_group_members").select("team_id").eq("user_id", uid).in("team_id", scopedTeamIds)
      : { data: [] as { team_id: string }[] };
    const memberTeamIds = (memberRows || []).map((row: any) => row.team_id);
    const memberSet = new Set(memberTeamIds);
    const teamsWithGroups = followedTeams.map(team => ({ ...team, group_name: groupNames.get(team.id) || team.name + " Fan Group", is_member: memberSet.has(team.id) }));
    setTeams(teamsWithGroups);
    setTeamId(current => teamsWithGroups.some(team => team.id === current) ? current : teamsWithGroups.find(team => team.is_member)?.id || teamsWithGroups[0]?.id || "");
    if (!memberTeamIds.length) { setPosts([]); setComments({}); return; }
    const { data, error } = await supabase.from("team_fan_group_posts")
      .select("id,author_id,team_id,body,image_url,is_pinned,created_at,profiles:profiles!team_fan_group_posts_author_id_fkey(id,display_name,avatar_url,account_type),teams(id,name,logo_url,logo_bg)")
      .in("team_id", memberTeamIds).eq("status", "published")
      .order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100);
    if (error) { setMessage(error.message); return; }
    const groupNameByTeam = new Map(teamsWithGroups.map(team => [team.id, team.group_name || team.name + " Fan Group"]));
    const rows = await Promise.all((data || []).map(async (p: any) => {
      const team = Array.isArray(p.teams) ? p.teams[0] : p.teams;
      const author = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const { data: signed } = p.image_url ? await supabase.storage.from("fan-group-images").createSignedUrl(p.image_url, 600) : { data: null };
      return { ...p, profiles: author, image_src: signed?.signedUrl || null, teams: team ? { ...team, group_name: groupNameByTeam.get(p.team_id) || team.name + " Fan Group" } : null };
    }));
    setPosts(rows as FanPost[]);
    const ids = rows.map((post: any) => post.id);
    if (ids.length) {
      const { data: commentRows } = await supabase.from("team_fan_group_comments")
        .select("id,post_id,author_id,body,created_at,profiles:profiles!team_fan_group_comments_author_id_fkey(display_name,avatar_url)")
        .in("post_id", ids).order("created_at", { ascending: true });
      const grouped: Record<string, GroupComment[]> = {};
      (commentRows || []).forEach((comment: any) => { (grouped[comment.post_id] ||= []).push({ ...comment, profiles: Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles }); });
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
      const active = getHoopCheckEntitlements({ accountType: p?.account_type, subscription: s }).canReadFanFeed;
      if (p?.account_type !== "fan") { setLoading(false); return; }
      setMembershipActive(active);
      if (!active) { setLoading(false); return; }
      await load(u.id); if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [load]);

  async function publish() {
    if (!user || profile?.account_type !== "fan" || !teamId || !selectedTeam?.is_member || (!body.trim() && !photo) || posting) return;
    setPosting(true); setMessage(ft("moderating"));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData(); form.append("action", "create_post"); form.append("team_id", teamId); form.append("body", body.trim());
      if (photo) form.append("image", photo);
      const response = await fetch("/api/fan-groups", { method: "POST", headers: { Authorization: "Bearer " + session?.access_token }, body: form });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.message || ft("publishFailed"));
      setBody(""); setPhoto(null); setPhotoPreview(""); setComposerOpen(false); setTeamSearch(""); setMessage(ft("published"));
      await load(user.id);
    } catch (e: any) { setMessage(e?.message || ft("publishFailed")); }
    finally { setPosting(false); }
  }

  async function sharePost(post: FanPost) {
    const url = `${window.location.origin}/team-hub/groups/${encodeURIComponent(post.team_id)}`;
    try {
      if (navigator.share) await navigator.share({ title: ft("shareTitle"), text: post.body.slice(0, 160), url });
      else { await navigator.clipboard.writeText(url); setMessage(ft("linkCopied")); }
    } catch (error: any) { if (error?.name !== "AbortError") setMessage(ft("shareFailed")); }
  }

  async function addComment(post: FanPost) {
    const text = (drafts[post.id] || "").trim();
    if (!user || !text) return;
    const { data: { session } } = await supabase.auth.getSession();
    const form = new FormData(); form.append("action", "comment"); form.append("team_id", post.team_id); form.append("post_id", post.id); form.append("body", text);
    const response = await fetch("/api/fan-groups", { method: "POST", headers: { Authorization: "Bearer " + session?.access_token }, body: form });
    const result = await response.json();
    if (!response.ok || result.ok !== true) { setMessage(result.message || ft("commentFailed")); return; }
    setDrafts(prev => ({ ...prev, [post.id]: "" }));
    await load(user.id);
  }
  async function followFan(targetId: string) {
    if (!user || targetId === user.id) return;
    const { error } = await supabase.from("follow_relationships").upsert({ follower_id: user.id, target_id: targetId, target_type: "fan" }, { onConflict: "follower_id,target_type,target_id" });
    if (error) setMessage(error.message);
    else { setFollowing(prev => new Set(prev).add(targetId)); setMessage(ft("following")); }
  }

  if (loading) return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><FeedLoadingSkeleton count={3} /></div></main></PageShell>;
  if (!user) return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><section className="hero-card"><h1>{ft("title")}</h1><p>{ft("signIn")}</p><Link className="btn" href="/login">{t("signIn")}</Link></section></div></main></PageShell>;
  if (profile?.account_type !== "fan") return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><section className="hero-card"><h1>{ft("fansOnly")}</h1><p>{ft("separateSurface")}</p><Link className="btn" href="/login">{ft("playerFeed")}</Link></section></div></main></PageShell>;
  if (!membershipActive) return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page"><div className="page-container"><section className="hero-card"><h1>{ft("membershipRequired")}</h1><p>{ft("membershipDescription")}</p><Link className="btn" href="/membership">{t("membership")}</Link></section></div></main></PageShell>;
  return <PageShell><main className="page-shell hc-feed-page hc-fan-feed-page">
    <FanBasketballSideSwitch />
    <div className="page-container">
      <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/fans">{ft("discoverFans")}</Link><Link href="/team-hub">{ft("teamHub")}</Link><Link href="/teams">{ft("teams")}</Link></nav></header>
      <section className="hero-card hc-feed-hero"><div><p className="eyebrow">{ft("kicker")}</p><h1>{ft("title")}</h1><p className="muted">{ft("subtitle")}</p></div></section>
      <section className="hc-fan-feed-explainer" aria-label={ft("feedExplainer")}>{ft("feedExplainer")}</section>
      <section className="hc-fan-feed-post-entry" aria-label={ft("postForTeam")}>
        {!composerOpen ? <div className="dashboard-card hc-feed-composer hc-fan-feed-post-prompt"><div><strong>{ft("postPromptTitle")}</strong><p className="muted">{ft("postPromptBody")}</p></div><button type="button" className="btn hc-feed-post-button" disabled={!teams.length} onClick={() => { setTeamSearch(""); setTeamId(""); setComposerOpen(true); }}>{ft("post")}</button>{!teams.length && <p className="muted">{ft("followTeamFirst")} <Link href="/teams">{ft("teams")}</Link></p>}</div> : <section className="dashboard-card hc-feed-composer">
          <div className="hc-fan-feed-composer-heading"><div><span className="card-kicker">{ft("postForTeam")}</span><h2>{ft("chooseTeam")}</h2></div><button type="button" className="hc-feed-action-pill" onClick={() => { setComposerOpen(false); setTeamId(""); }}>{ft("cancel")}</button></div>
          {!selectedTeam ? <><input className="hc-feed-team-search" type="search" value={teamSearch} onChange={e => setTeamSearch(e.target.value)} placeholder={ft("searchFollowedTeams")} aria-label={ft("searchFollowedTeams")} /><div className="hc-fan-feed-team-picker" role="listbox" aria-label={ft("followedTeams")}>{filteredTeams.map(team => <button type="button" role="option" aria-selected={false} key={team.id} onClick={() => { setTeamId(team.id); setTeamSearch(""); }}><TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={30}/><span><strong>{team.name}</strong><small>{team.group_name} · {team.is_member ? ft("joined") : ft("joinRequired")}</small></span><span aria-hidden="true">›</span></button>)}{!filteredTeams.length && <p className="muted">{ft("noFollowedTeamsMatch")}</p>}</div></>
          : !selectedTeam.is_member ? <div className="hc-fan-feed-join-required"><strong>{ft("joinBeforePosting").replace("{team}", selectedTeam.name)}</strong><p className="muted">{ft("groupMembersOnly")}</p><Link className="btn" href={"/team-hub/groups/" + selectedTeam.id}>{ft("openJoinGroup")}</Link></div>
          : <><div className="hc-fan-feed-target"><TeamLogo name={selectedTeam.name} logoUrl={selectedTeam.logo_url} logoBg={selectedTeam.logo_bg} size={30}/><span><small>{ft("postingTo")}</small><strong>{selectedTeam.name} {ft("fans")}</strong><small>{selectedTeam.group_name}</small></span><button type="button" className="hc-feed-action-pill" onClick={() => { setTeamId(""); setBody(""); }}>{ft("change")}</button></div>
            <div className="hc-feed-composer__editor"><div className="hc-feed-composer__avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : "HC"}</div><textarea value={body} maxLength={2000} rows={3} onChange={e => setBody(e.target.value)} placeholder={teamComposerPlaceholder}/></div>
            <div className="hc-feed-composer__footer"><label className="hc-feed-photo-button" htmlFor="fan-feed-photo">{ft("addPhoto")}</label><input id="fan-feed-photo" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file=e.target.files?.[0]; if(!file)return; if(file.size>4*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(file.type)){setMessage(ft("photoLimit"));return;} setPhoto(file);setPhotoPreview(URL.createObjectURL(file)); }}/><span className="hc-feed-counter">{body.length}/2000</span><button className="btn hc-feed-post-button" disabled={posting || (!body.trim() && !photo)} onClick={() => void publish()}>{posting ? ft("posting") : ft("post")}</button></div>
            {photoPreview && <div style={{marginTop:12}}><img src={photoPreview} alt={ft("photoPreview")} style={{width:"100%",maxHeight:360,objectFit:"cover",borderRadius:16}}/><button type="button" className="btn dark" onClick={() => {setPhoto(null);setPhotoPreview("");}}>{ft("removePhoto")}</button></div>}</>}
          {message && <p className="hc-feed-message" role="status">{message}</p>}
        </section>}
      </section>
      <section className="hc-feed-stream" aria-label={ft("recentPosts")}>{posts.length ? posts.map(post => <FeedPostCard key={post.id}>
        <header className="hc-feed-post-header"><FeedAuthorRow><Link href={"/fans/" + post.author_id} aria-label={ft("viewFanProfile")}>{post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} alt="" className="hc-feed-post-avatar"/> : <div className="player-avatar-fallback hc-feed-post-avatar">HC</div>}</Link><div className="hc-feed-post-author__meta"><Link href={"/fans/" + post.author_id}><strong>{post.profiles?.display_name || ft("fan")}</strong></Link><small>{formatDate(post.created_at,{dateStyle:"medium",timeStyle:"short"})}</small></div></FeedAuthorRow>{post.teams && <Link className="hc-feed-post-topic" href={"/teams/" + post.team_id}><TeamLogo name={post.teams.name} logoUrl={post.teams.logo_url} logoBg={post.teams.logo_bg} size={28}/>{post.teams.name}</Link>}</header>
        {post.teams && <div className="hc-fan-feed-group-label"><span>{ft("fanGroup")}</span><Link href={"/team-hub/groups/" + post.team_id}>{post.teams.group_name || post.teams.name + " Fan Group"}</Link></div>}
        <FeedMediaArea>{post.body.trim() && <p style={{whiteSpace:"pre-wrap"}}>{post.body}</p>}{post.image_src && <img src={post.image_src} alt={ft("postPhoto")} className="hc-feed-post-image"/>}</FeedMediaArea>
        <FeedActionRow><button type="button" className="hc-feed-action-pill" onClick={() => setOpenComments(prev => ({...prev,[post.id]:!prev[post.id]}))}>{ft("comment")} · {(comments[post.id] || []).length}</button><button type="button" className="hc-feed-action-pill" onClick={() => void sharePost(post)}>{ft("share")}</button><button type="button" className="hc-feed-action-pill" onClick={() => { const reason=window.prompt(ft("reportPrompt")); if(reason) void reportPost(post,reason); }}>{ft("report")}</button>{post.is_pinned && <span className="hc-feed-expires">{ft("pinned")}</span>}</FeedActionRow>
        {openComments[post.id] && <div className="hc-feed-comments-panel"><strong>{ft("comments")}</strong>{(comments[post.id] || []).map(comment => <div key={comment.id}><strong>{comment.profiles?.display_name || ft("fan")}</strong><p>{comment.body}</p></div>)}<div className="hc-feed-composer__footer"><input value={drafts[post.id] || ""} maxLength={1000} onChange={e => setDrafts(prev => ({...prev,[post.id]:e.target.value}))} placeholder={ft("commentPlaceholder")}/><button className="btn" disabled={!drafts[post.id]?.trim()} onClick={() => void addComment(post)}>{ft("send")}</button></div></div>}
        <footer><Link className="hc-feed-action-pill" href={"/team-hub/groups/" + post.team_id}>{ft("openGroup")}</Link><button type="button" className="hc-feed-action-pill" disabled={post.author_id===user.id || following.has(post.author_id)} onClick={() => void followFan(post.author_id)}>{following.has(post.author_id) ? ft("following") : ft("followFan")}</button></footer>
      </FeedPostCard>) : <FeedEmptyState><span className="eyebrow">{ft("emptyKicker")}</span>{selectedTeam?.is_member ? <><h2>{ft("emptyClubTitle").replace("{team}",selectedTeam.name)}</h2><p className="muted">{ft("emptyClubBody").replace("{team}",selectedTeam.name)}</p><button type="button" className="btn" onClick={() => {setTeamId(selectedTeam.id);setComposerOpen(true);}}>{ft("beFirstToPost")}</button></> : selectedTeam ? <><h2>{ft("joinBeforeReading").replace("{team}",selectedTeam.name)}</h2><p className="muted">{ft("groupMembersOnly")}</p><Link className="btn" href={"/team-hub/groups/" + selectedTeam.id}>{ft("openJoinGroup")}</Link></> : <><h2>{ft("emptyTitle")}</h2><p className="muted">{ft("emptyBody")}</p><Link className="btn" href="/teams">{ft("followClubs")}</Link></>}</FeedEmptyState>}</section>
      {message && <p className="hc-feed-message" role="status">{message}</p>}
    </div>
  </main></PageShell>;
}
