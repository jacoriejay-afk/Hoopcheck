"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { PageShell } from "../../../../components/LayoutSystem";
import HoopLoading from "../../../../components/HoopLoading";
import { useLanguage } from "../../../../components/LanguageProvider";
import "../../../../app/hoopfeed-shared.css";

type Summary = { group_name: string; member_count: number; join_mode: "open" | "approval"; is_member: boolean; has_pending_request: boolean };
type GroupPost = { id: string; team_id: string; author_id: string; body: string; image_url: string | null; image_src?: string | null; is_pinned: boolean; created_at: string; profiles?: { display_name: string | null; avatar_url: string | null } | null };
type GroupComment = { id: string; post_id: string; author_id: string; body: string; created_at: string; profiles?: { display_name: string | null } | null };
type Member = { user_id: string; joined_at: string; moderator_type?: string | null; display_name?: string | null };

export default function TeamFanGroupPage() {
  const params = useParams();
  const router = useRouter();
  const { formatNumber, formatDate } = useLanguage();
  const teamId = String(params.teamId || "");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [teamName, setTeamName] = useState("");
  const [teamBasketballSide, setTeamBasketballSide] = useState<"mens" | "womens">("mens");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [isFan, setIsFan] = useState(false);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [comments, setComments] = useState<Record<string, GroupComment[]>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const teamProfileHref = (teamBasketballSide === "womens" ? "/womens/" : "/teams/") + teamId;

  const load = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);
    if (!currentUser) { setLoading(false); return; }
    const [{ data: profile }, { data: team }, { data: summaryRows }, { data: moderators }, { data: ownMembership, error: ownMembershipError }] = await Promise.all([
      supabase.from("profiles").select("account_type").eq("id", currentUser.id).maybeSingle(),
      supabase.from("teams").select("name,basketball_type").eq("id", teamId).maybeSingle(),
      supabase.rpc("get_team_fan_group_summary", { p_team_id: teamId }),
      supabase.from("team_fan_group_moderators").select("user_id,moderator_type").eq("team_id", teamId),
      supabase.from("team_fan_group_members").select("user_id").eq("team_id", teamId).eq("user_id", currentUser.id).maybeSingle()
    ]);
    setTeamName(team?.name || "Team");
    setTeamBasketballSide(team?.basketball_type === "womens" ? "womens" : "mens");
    setIsFan(profile?.account_type === "fan");
    const row = Array.isArray(summaryRows) ? summaryRows[0] : summaryRows;
    setSummary(row ? { ...row, is_member: ownMembershipError ? Boolean(row.is_member) : Boolean(ownMembership), member_count: Math.max(Number(row.member_count || 0), ownMembership ? 1 : 0) } : null);
    const { data: platformRole } = await supabase.rpc("get_current_user_admin_role");
    const moderator = Boolean((moderators || []).some((m: any) => m.user_id === currentUser.id) ||
      platformRole === "admin" ||
      (platformRole === "moderator" && (moderators || []).some((m: any) => m.moderator_type === "platform")));
    if (profile?.account_type !== "fan" && !moderator) { router.replace((team?.basketball_type === "womens" ? "/womens/" : "/teams/") + teamId); return; }
    setIsModerator(moderator);
    if ((ownMembershipError ? row?.is_member : Boolean(ownMembership)) || moderator) {
      const { data: postRows } = await supabase.from("team_fan_group_posts")
        .select("id,team_id,author_id,body,image_url,is_pinned,created_at,profiles:profiles!team_fan_group_posts_author_id_fkey(display_name,avatar_url)")
        .eq("team_id", teamId).eq("status", "published").order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
      const normalized = await Promise.all((postRows || []).map(async (p: any) => {
        const { data: signed } = p.image_url ? await supabase.storage.from("fan-group-images").createSignedUrl(p.image_url, 600) : { data: null };
        return { ...p, image_src: signed?.signedUrl || null, profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles };
      }));
      setPosts(normalized as GroupPost[]);
      const ids = normalized.map((p: any) => p.id);
      if (ids.length) {
        const { data: commentRows } = await supabase.from("team_fan_group_comments")
          .select("id,post_id,author_id,body,created_at,profiles:profiles!team_fan_group_comments_author_id_fkey(display_name)")
          .in("post_id", ids).order("created_at", { ascending: true });
        const grouped: Record<string, GroupComment[]> = {};
        (commentRows || []).forEach((c: any) => {
          (grouped[c.post_id] ||= []).push({ ...c, profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles });
        });
        setComments(grouped);
      } else { setComments({}); }
    } else { setPosts([]); setComments({}); }
    if (moderator) {
      const { data: memberRows } = await supabase.from("team_fan_group_members").select("user_id,joined_at").eq("team_id", teamId).order("joined_at", { ascending: true });
      const ids = [...new Set((memberRows || []).map((m: any) => m.user_id))];
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,display_name").in("id", ids) : { data: [] as any[] };
      const names = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.display_name]));
      const modMap = Object.fromEntries((moderators || []).map((m: any) => [m.user_id, m.moderator_type]));
      setMembers((memberRows || []).map((m: any) => ({ ...m, display_name: names[m.user_id], moderator_type: modMap[m.user_id] || null })));
    }
    setLoading(false);
  }, [teamId, router]);

  useEffect(() => { void load(); }, [load]);

  async function act(action: string, values: Record<string, string> = {}, image?: File | null) {
    if (!user) return;
    setBusy(true); setMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setMessage("Your session expired. Please sign in again."); return; }
      const form = new FormData();
      form.append("action", action); form.append("team_id", teamId);
      Object.entries(values).forEach(([key, value]) => form.append(key, value));
      if (image) form.append("image", image);
      const response = await fetch("/api/fan-groups", { method: "POST", headers: { Authorization: "Bearer " + session.access_token }, body: form });
      const result = await response.json().catch(() => ({}));
      setMessage(result.message || (response.ok && result.ok ? action === "join" ? "You joined the Fan Group." : action === "leave" ? "You left the Fan Group." : "Saved." : "That action could not be completed."));
      if (response.ok && result.ok) {
        if (action === "join" || action === "leave") {
          const joined = action === "join";
          setSummary(current => current ? {
            ...current,
            is_member: joined,
            member_count: Math.max(0, Number(current.member_count || 0) + (joined ? (current.is_member ? 0 : 1) : (current.is_member ? -1 : 0)))
          } : current);
          if (!joined) { setPosts([]); setComments({}); }
        }
        await load();
      }
      return result;
    } catch {
      setMessage("Connection failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!draft.trim() && !photo) return;
    const result = await act("create_post", { body: draft }, photo);
    if (result?.ok) { setDraft(""); setPhoto(null); }
  }
  async function comment(postId: string) {
    const body = (commentDrafts[postId] || "").trim();
    if (!body) return;
    const result = await act("comment", { body, post_id: postId });
    if (result?.ok) setCommentDrafts(old => ({ ...old, [postId]: "" }));
  }
  if (loading) return <PageShell><main className="page-shell hc-feed-page"><div className="page-container"><HoopLoading label="Loading Fan Group…" /></div></main></PageShell>;
  if (!user) return <PageShell><main className="page-shell hc-feed-page"><div className="page-container"><section className="hero-card"><h1>Sign in to join this Fan Group</h1><Link className="btn" href="/login">Sign in</Link></section></div></main></PageShell>;
  if (!summary) return <PageShell><main className="page-shell hc-feed-page"><div className="page-container"><h1>Fan Group unavailable</h1><Link href={teamProfileHref}>Back to team</Link></div></main></PageShell>;

  return <PageShell><main className="page-shell hc-feed-page hc-team-fan-group-page"><div className="page-container">
    <header className="topbar"><Link href="/team-hub" className="brand">TEAM HUB</Link><nav className="topnav"><Link href={teamProfileHref}>Team page</Link><Link href="/team-hub">Your teams</Link></nav></header>
    <section className="hero-card hc-feed-hero"><p className="eyebrow">FAN HQ · OFFICIAL COMMUNITY</p><h1>{summary.group_name}</h1><p className="muted">{teamName} supporters, together in one official fan space.</p><p className="hc-feed-expiry-note">{Number(summary.member_count || 0).toLocaleString()} MEMBERS <span>Group posts stay here permanently.</span></p></section>
    {!summary.is_member && <section className="dashboard-card hc-feed-shared-card hc-team-fan-group-locked"><h2>Join to see the conversation</h2><p className="muted">The group is visible to everyone, but posts and comments are private to members.</p>{summary.join_mode === "open" ? <button className="btn" disabled={busy} onClick={() => void act("join")}>Join Fan Group</button> : <button className="btn" disabled={busy || summary.has_pending_request} onClick={() => void act("join")}>{summary.has_pending_request ? "Request Pending" : "Request to Join"}</button>}</section>}
    {summary.is_member && <>
      {isFan && summary?.is_member && <section className="dashboard-card hc-feed-composer hc-team-fan-group-composer hc-liquid-glass-group-composer"><div className="hc-team-group-posting-target"><span className="card-kicker">POST TO THE GROUP</span><strong>Posting to {teamName} fans</strong><small>{summary.group_name}</small></div><textarea id="fan-group-post-body" value={draft} maxLength={2000} rows={3} onChange={e => setDraft(e.target.value)} placeholder="Share something with the fans…" /><div className="hc-feed-composer__footer"><label className="hc-feed-photo-button">Photo<input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} /></label><span className="hc-feed-counter">{draft.length}/2000</span><button className="btn hc-feed-post-button" disabled={busy || (!draft.trim() && !photo)} onClick={() => void publish()}>{busy ? "Posting…" : "Post"}</button></div>{photo && <p className="muted">{photo.name} · <button type="button" onClick={() => setPhoto(null)}>Remove</button></p>}</section>}
      <section className="hc-feed-stream" aria-label="Fan Group posts">{posts.length ? posts.map(post => <article key={post.id} className="dashboard-card hc-feed-shared-card hc-team-fan-group-post">
        <header className="hc-feed-post-header"><div className="hc-feed-shared-author"><div className="hc-feed-post-author__meta"><strong>{post.profiles?.display_name || "Fan"}</strong><small>{new Date(post.created_at).toLocaleString()}</small></div></div><span className="hc-feed-post-topic">{summary.group_name}</span>{post.is_pinned && <span className="hc-feed-post-topic">PINNED</span>}</header>
        {post.body && <div className="hc-feed-post-body"><p>{post.body}</p></div>}
        {post.image_src && <img src={post.image_src} alt="Fan Group post" className="hc-feed-post-image"/>}
        <div className="hc-team-fan-group-post-actions">{isFan && <button type="button" className="hc-feed-action-pill" onClick={() => { const reason = window.prompt("Why are you reporting this post?"); if (reason) void act("report_post", { post_id: post.id, reason }); }}>Report</button>}{isModerator && <><button type="button" className="hc-feed-action-pill" onClick={() => void act("pin_post", { post_id: post.id })}>Pin</button><button type="button" className="hc-feed-action-pill" onClick={() => void act("remove_post", { post_id: post.id })}>Remove</button></>}</div>
        <div className="hc-team-fan-group-comments">{(comments[post.id] || []).map(c => <p key={c.id}><strong>{c.profiles?.display_name || "Fan"}:</strong> {c.body}</p>)}{isFan && <div><input value={commentDrafts[post.id] || ""} maxLength={1000} onChange={e => setCommentDrafts(old => ({ ...old, [post.id]: e.target.value }))} placeholder="Write a comment…" /><button className="btn" disabled={busy || !commentDrafts[post.id]?.trim()} onClick={() => void comment(post.id)}>Send</button></div>}</div>
      </article>) : <section className="dashboard-card hc-feed-empty hc-feed-shared-empty"><span className="eyebrow">CLUB FAN GROUPS</span><h2>No posts yet — be the first to post for {teamName}.</h2><p className="muted">This group is waiting for its first post. Start the conversation with {teamName} fans.</p>{isFan && <button type="button" className="btn" onClick={() => document.getElementById("fan-group-post-body")?.focus()}>Be the first to post</button>}</section>}</section>
    </>}
    {isModerator && <section className="dashboard-card hc-feed-shared-card hc-team-fan-group-moderator"><div className="hc-team-fan-group-mod-head"><div><p className="eyebrow">MODERATION</p><h2>Moderator panel</h2></div><span className="muted">Membership: Open to all fans</span></div>

      <div><h3>Members ({members.length})</h3>{members.map(m => <div className="hc-team-fan-group-member-row" key={m.user_id}><span>{m.display_name || "Fan"}{m.moderator_type ? " · " + m.moderator_type.replaceAll("_", " ") : ""}</span>{!m.moderator_type && <button className="hc-feed-action-pill" onClick={() => void act("appoint_co_moderator", { user_id: m.user_id })}>Make co-moderator</button>}{m.moderator_type === "fan_co_moderator" && <button className="hc-feed-action-pill" onClick={() => void act("remove_co_moderator", { user_id: m.user_id })}>Remove moderator</button>}<button className="hc-feed-action-pill" onClick={() => void act("remove_member", { user_id: m.user_id })}>Remove member</button></div>)}</div>
    </section>}
    {message && <p className="hc-feed-message" role="status">{message}</p>}
  </div></main></PageShell>;
}
