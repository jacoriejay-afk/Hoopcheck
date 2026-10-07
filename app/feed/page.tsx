"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type FeedPost = {
  id: string;
  body: string;
  created_at: string;
  expires_at: string;
  author_id: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
    current_country: string | null;
  } | { display_name: string | null; avatar_url: string | null; current_country: string | null; }[] | null;
};

type Profile = {
  account_type: string;
  current_country: string | null;
};

type Subscription = {
  plan: string | null;
  status: string | null;
  access_status: string | null;
};

export default function Feed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [body, setBody] = useState("");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const hasFeedAccess =
    profile?.account_type === "player" &&
    (subscription?.plan === "pro" || subscription?.plan === "premium") &&
    (subscription?.status === "active" || subscription?.status === "trialing") &&
    (subscription?.access_status === null || subscription?.access_status === "active" || subscription?.access_status === "trialing");

  async function load() {
    const { data } = await supabase
      .from("feed_posts")
      .select("id,body,created_at,expires_at,author_id,profiles(display_name,avatar_url,current_country)")
      .eq("status", "approved")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts((data || []).map((row) => ({ ...row, profiles: Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : (row.profiles ?? null) })) as FeedPost[]);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const [{ data: profileData }, { data: subscriptionData }] = await Promise.all([
        supabase.from("profiles").select("account_type,current_country").eq("id", currentUser.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,access_status").eq("user_id", currentUser.id).maybeSingle(),
      ]);

      if (!mounted) return;
      setProfile(profileData);
      setSubscription(subscriptionData);
      if (profileData?.account_type === "player" && (subscriptionData?.plan === "pro" || subscriptionData?.plan === "premium")) {
        await load();
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  async function post() {
    if (!user || !hasFeedAccess || !body.trim()) return;
    setMsg("");
    const { error } = await supabase.from("feed_posts").insert({
      author_id: user.id,
      body: body.trim(),
      status: "approved",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setBody("");
    setMsg("Posted. Your experience will stay in the player feed for 24 hours.");
    await load();
  }

  if (loading) {
    return <main className="page-shell"><div className="page-container"><section className="hero-card"><h1>Loading player feed...</h1></section></div></main>;
  }

  if (!user) {
    return <main className="page-shell"><div className="page-container"><section className="hero-card"><p className="eyebrow">PLAYER EXPERIENCE FEED</p><h1>Sign in to continue</h1><p className="muted">The player feed is for active Pro and Premium players.</p><Link href="/login" className="btn">Sign In</Link></section></div></main>;
  }

  if (!hasFeedAccess) {
    return (
      <main className="page-shell">
        <div className="page-container">
          <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/players">Players</Link><Link href="/account">Profile</Link></nav></header>
          <section className="hero-card">
            <p className="eyebrow">PLAYER EXPERIENCE FEED</p>
            <h1>Daily Player Experiences</h1>
            <p className="muted">Pro and Premium players can share what life is really like during their current season. Posts are shown to players following them in the same current-season country and disappear after 24 hours.</p>
            <div className="actions"><Link href="/membership" className="btn">Upgrade Membership</Link><Link href="/dashboard" className="btn dark">Back to Dashboard</Link></div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/players">Players</Link><Link href="/account">Profile</Link></nav></header>
        <section className="hero-card">
          <p className="eyebrow">PRO / PREMIUM PLAYER FEED</p>
          <h1>Daily Player Experiences</h1>
          <p className="muted">Share your current-season experience with players who follow you in the same country. Every post disappears after 24 hours.</p>
          {profile?.current_country && <p className="muted"><strong>Current season country:</strong> {profile.current_country}</p>}
        </section>

        <section className="dashboard-card" style={{marginTop:18}}>
          <span className="card-kicker">SHARE TODAY</span>
          <textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} maxLength={2000} placeholder="What happened today? Travel, practice, game day, teammates, culture, food, wins, challenges..." />
          <div style={{display:"flex",gap:10,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
            <button className="btn" onClick={post} disabled={!body.trim()}>Post for 24 hours</button>
            {msg&&<span className="muted">{msg}</span>}
          </div>
        </section>

        <section style={{display:"grid",gap:14,marginTop:18}}>
          {posts.length ? posts.map(p => (
            <article className="dashboard-card" key={p.id}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                {p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} alt="" style={{width:46,height:46,borderRadius:"50%",objectFit:"cover"}}/> : <div className="player-avatar-fallback">HC</div>}
                <div>
                  <strong>{p.profiles?.display_name || "HoopCheck Player"}</strong>
                  {p.profiles?.current_country && <div className="muted">{p.profiles.current_country}</div>}
                </div>
              </div>
              <p style={{whiteSpace:"pre-wrap",marginTop:14}}>{p.body}</p>
              <small className="muted">Expires {new Date(p.expires_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})} today</small>
            </article>
          )) : <div className="dashboard-card"><h2>No active experiences yet.</h2><p className="muted">Follow players in your current-season country to see their daily posts here.</p></div>}
        </section>
      </div>
    </main>
  );
}
