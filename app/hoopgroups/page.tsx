"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import "./hoopgroups.css";

type Space = { id: string; slug: string; name: string; category: string; description: string };
type Channel = { id: string; space_id: string; slug: string; name: string; sort_index: number };
type Post = { id: string; author_id: string; body: string; moderation_status: string; created_at: string };
const enabled = process.env.NEXT_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true";
const planned = [
  { slug:"world-basketball", name:"World Basketball", category:"global", description:"All leagues, all levels, one basketball world." },
  { slug:"players-network", name:"Players Network", category:"players", description:"Player-to-player community and career experiences." },
  { slug:"fans-courtside", name:"Fans Courtside", category:"fans", description:"Basketball fans beyond one club." },
  { slug:"coaches-corner", name:"Coaches Corner", category:"coaches", description:"Coaching ideas and player development." },
  { slug:"scouting-room", name:"Scouting Room", category:"agents", description:"Professional basketball scouting conversations." },
  { slug:"womens-hoops", name:"Women’s Hoops", category:"womens", description:"Women’s basketball worldwide." },
];

export default function HoopGroupsPage() {
  const [userId, setUserId] = useState("");
  const [accountRole, setAccountRole] = useState("");
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [memberships, setMemberships] = useState<string[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [ready, setReady] = useState(false);
  const [backendReady, setBackendReady] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setReady(true); return; }
    setUserId(user.id);
    const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
    setAccountRole(profile?.account_type || "");
    if (!enabled) { setReady(true); return; }
    const [spaceResult, channelResult, memberResult] = await Promise.all([
      supabase.from("hoop_group_spaces").select("id,slug,name,category,description").order("name"),
      supabase.from("hoop_group_channels").select("id,space_id,slug,name,sort_index").order("sort_index"),
      supabase.from("hoop_group_members").select("space_id").eq("user_id", user.id),
    ]);
    if (spaceResult.error || channelResult.error || memberResult.error) {
      setFeedback("HoopGroups channels are not available. The separate community backend has not been approved for release.");
      setReady(true); return;
    }
    setBackendReady(true);
    setSpaces((spaceResult.data || []) as Space[]);
    setChannels((channelResult.data || []) as Channel[]);
    setMemberships((memberResult.data || []).map(item => item.space_id));
    setReady(true);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const ordered = useMemo(() => [...spaces].sort((a,b) =>
    Number(b.category === accountRole || accountRole === "scout" && b.category === "agents") -
    Number(a.category === accountRole || accountRole === "scout" && a.category === "agents") ||
    a.name.localeCompare(b.name)), [spaces,accountRole]);
  const selected = spaces.find(item => item.id === spaceId) || ordered[0] || null;
  const availableChannels = channels.filter(item => item.space_id === selected?.id);
  const channel = availableChannels.find(item => item.id === channelId) || availableChannels[0] || null;
  const joined = Boolean(selected && memberships.includes(selected.id));

  useEffect(() => {
    if (!enabled || !backendReady || !channel?.id || !joined) { setPosts([]); return; }
    let active = true;
    void supabase.from("hoop_group_posts")
      .select("id,author_id,body,moderation_status,created_at").eq("channel_id", channel.id)
      .order("created_at", { ascending: false }).limit(100)
      .then(({data,error}) => { if (active) { setPosts(error ? [] : ((data || []) as Post[]).reverse()); if (error) setFeedback("Could not load channel messages."); } });
    return () => { active = false; };
  }, [backendReady,channel?.id,joined]);

  async function join() {
    if (!selected || !userId || busy || !backendReady) return;
    setBusy(true);setFeedback("");
    const { error } = await supabase.from("hoop_group_members").insert({ space_id: selected.id, user_id: userId });
    if (error) setFeedback("Unable to join this community.");
    else setMemberships(items => [...new Set([...items, selected.id])]);
    setBusy(false);
  }
  async function send() {
    if (!channel || !userId || !joined || !draft.trim() || busy || !backendReady) return;
    setBusy(true);setFeedback("");
    const { error } = await supabase.from("hoop_group_posts").insert({
      channel_id:channel.id,author_id:userId,body:draft.trim().slice(0,1200),moderation_status:"pending"
    });
    if (error) setFeedback("Could not submit message.");
    else {
      setDraft("");setFeedback("Message submitted for moderation. It is visible only to you until approved.");
      const {data}=await supabase.from("hoop_group_posts").select("id,author_id,body,moderation_status,created_at").eq("channel_id",channel.id).order("created_at",{ascending:false}).limit(100);
      setPosts(((data||[]) as Post[]).reverse());
    }
    setBusy(false);
  }
  async function report(post: Post) {
    const reason = window.prompt("Why are you reporting this message? (3–350 characters)")?.trim();
    if (!reason || reason.length < 3 || reason.length > 350 || !userId) return;
    const {error}=await supabase.from("hoop_group_reports").insert({post_id:post.id,reporter_id:userId,reason});
    setFeedback(error ? "Report could not be submitted or was already filed." : "Report submitted for review.");
  }
  async function block(post: Post) {
    if (!userId || post.author_id === userId || !window.confirm("Hide this member's messages from your HoopGroups?")) return;
    const {error}=await supabase.from("hoop_group_blocks").insert({blocker_id:userId,blocked_id:post.author_id});
    if (error) setFeedback("Could not block this member.");
    else setPosts(items=>items.filter(item=>item.author_id!==post.author_id));
  }

  return <main className="page-shell hc-hoopgroups-page"><div className="page-container">
    <header className="hc-hoopgroups-header"><div><p className="eyebrow">HOOPCHECK COMMUNITIES</p><h1>HoopGroups</h1><p className="muted">Server-style basketball communities organized by topic and channels. This is separate from every club's Team Fan Group.</p></div><Link href="/team-hub/groups" className="btn dark">Team Fan Groups</Link></header>
    {!ready && <p role="status">Loading communities…</p>}
    {ready && !userId && <section className="dashboard-card"><h2>Join the conversation</h2><p>Sign in to browse community channels.</p><Link href="/login?returnTo=%2Fhoopgroups" className="btn">Sign in</Link></section>}
    {ready && userId && !backendReady ? <section className="dashboard-card"><h2>Community servers · preview</h2><p className="muted">These dedicated servers and channels are not live. Team Fan Groups remain available separately while the new moderation and database rollout is reviewed.</p>
      <div className="hc-hoopgroups-preview">{planned.map(space=><article key={space.slug}><strong>{space.name}</strong><p>{space.description}</p><small>Planned channels: #welcome · #general · #game-talk</small></article>)}</div><Link href="/team-hub/groups" className="btn">Browse official Team Fan Groups</Link></section> : null}
    {ready && userId && backendReady && <div className="hc-hoopgroups-shell">
      <nav className="hc-hoopgroups-servers" aria-label="Community servers">{ordered.map(space =>
        <button key={space.id} type="button" aria-pressed={selected?.id===space.id} onClick={()=>{setSpaceId(space.id);setChannelId("");setFeedback("");}}><strong>{space.name.slice(0,2).toUpperCase()}</strong><span>{space.name}</span></button>)}</nav>
      <aside className="hc-hoopgroups-channels"><h2>{selected?.name || "Choose a server"}</h2><p>{selected?.description}</p><strong>TEXT CHANNELS</strong>
        <nav aria-label="Community channels">{availableChannels.map(item=><button key={item.id} type="button" aria-pressed={channel?.id===item.id} onClick={()=>setChannelId(item.id)}># {item.name}</button>)}</nav>
        {selected && !joined && <button type="button" className="btn" disabled={busy} onClick={()=>void join()}>Join community</button>}
        <Link href="/team-hub/groups">Looking for your club? Open Fan Groups</Link>
      </aside>
      <section className="hc-hoopgroups-chat" aria-label="Community channel"><header><strong># {channel?.name || "general"}</strong><small>{joined ? "You're a member" : "Join to read and post"} · moderated channel</small></header>
        <div className="hc-hoopgroups-messages" role="log">{joined ? posts.length ? posts.map(post => <article key={post.id}><div><strong>{post.author_id===userId?"You":"Community member"}</strong><small>{new Date(post.created_at).toLocaleString()}</small></div><p>{post.body}</p>{post.moderation_status!=="approved" ? <small>Pending moderation · visible to you</small> : post.author_id!==userId && <div className="actions"><button type="button" onClick={()=>void report(post)}>Report</button><button type="button" onClick={()=>void block(post)}>Block member</button></div>}</article>) : <p>No approved channel messages yet.</p> : <p>Join this server to see its discussion channels.</p>}</div>
        {feedback && <p role="status">{feedback}</p>}
        {joined && channel && <form className="hc-hoopgroups-compose" onSubmit={event=>{event.preventDefault();void send();}}><label htmlFor="hc-group-post">Message in # {channel.name}</label><textarea id="hc-group-post" value={draft} maxLength={1200} rows={3} onChange={event=>setDraft(event.target.value)} placeholder="Share a basketball discussion… (review required)" /><button type="submit" className="btn" disabled={busy || !draft.trim()}>Submit for review</button></form>}
      </section>
    </div>}
  </div></main>;
}
