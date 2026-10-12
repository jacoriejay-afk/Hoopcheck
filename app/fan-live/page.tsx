"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";

type Game = { id: string; team_id: string; opponent_name: string; status: string; home_score: number | null; away_score: number | null; started_at: string | null };
type Team = { id: string; name: string };
type ChatMessage = { id: string; body: string; created_at: string; user_id: string };

export default function FanLivePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [selected, setSelected] = useState<Game | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setAllowed(false); setLoading(false); return; }

    const [{ data: profile }, { data: subscription }] = await Promise.all([
      supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status,current_period_end").eq("user_id", user.id).maybeSingle()
    ]);
    const active = (subscription?.status === "active" || subscription?.status === "trialing") &&
      (!subscription?.current_period_end || new Date(subscription.current_period_end) > new Date());
    const isFanMember = profile?.account_type === "fan" &&
      (subscription?.plan === "pro" || subscription?.plan === "premium") && active;
    setAllowed(isFanMember);
    if (!isFanMember) { setGames([]); setSelected(null); setLoading(false); return; }

    const { data: follows, error: followError } = await supabase.from("follow_relationships")
      .select("target_id").eq("follower_id", user.id).eq("target_type", "team").limit(50);
    if (followError) { setMessage("Couldn't refresh followed teams. Please try again."); setLoading(false); return; }
    const ids = (follows || []).map((x: { target_id: string }) => x.target_id).filter(Boolean);
    if (!ids.length) { setGames([]); setTeams({}); setSelected(null); setMessages([]); setLoading(false); return; }

    const [{ data: gameRows, error: gamesError }, { data: teamRows }] = await Promise.all([
      supabase.from("fan_live_games").select("id,team_id,opponent_name,status,home_score,away_score,started_at")
        .eq("status", "live").in("team_id", ids).order("started_at", { ascending: false }),
      supabase.from("teams").select("id,name").in("id", ids)
    ]);
    if (gamesError) setMessage("Live game updates are temporarily unavailable. Reconnecting…");
    const nextGames = (gameRows || []) as Game[];
    setGames(nextGames);
    setTeams(Object.fromEntries((teamRows || []).map((team: Team) => [team.id, team])));
    setSelected(current => nextGames.find(game => game.id === current?.id) || nextGames[0] || null);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (gameId: string) => {
    const { data, error } = await supabase.from("fan_live_chat_messages")
      .select("id,body,created_at,user_id").eq("game_id", gameId)
      .order("created_at", { ascending: true }).limit(200);
    if (!error) setMessages((data || []) as ChatMessage[]);
    else setMessage("Chat history couldn't load. Reconnecting…");
  }, []);

  useEffect(() => { void load(true); }, [load]);

  // Listen for score/status changes in the live-games table and refresh periodically
  // as a fallback if a realtime event is missed or the connection drops.
  useEffect(() => {
    const gamesChannel = supabase.channel("fan-live-games-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "fan_live_games" }, () => { void load(); })
      .subscribe();
    const refresh = window.setInterval(() => { void load(); }, 20000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(gamesChannel);
    };
  }, [load]);

  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    void loadMessages(selected.id);
    const channel = supabase.channel("fan-live-chat-" + selected.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fan_live_chat_messages", filter: "game_id=eq." + selected.id },
        payload => setMessages(current => current.some(item => item.id === payload.new.id) ? current : [...current, payload.new as ChatMessage].slice(-200)))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selected?.id, loadMessages]);

  async function send() {
    const text = body.trim();
    if (!text || !selected || sending) return;
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setMessage("Please sign in again to chat."); return; }
    setSending(true);
    setMessage("");
    const { error } = await supabase.from("fan_live_chat_messages")
      .insert({ game_id: selected.id, user_id: user.id, body: text });
    setSending(false);
    if (error) { setMessage("Message wasn't sent. Please try again."); return; }
    setBody("");
  }

  if (loading) return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading live games..." /></div></main>;
  if (!allowed) return <main className="page-shell"><div className="page-container"><section className="hero-card">
    <p className="eyebrow">PRO & PREMIUM FAN</p><h1>Live Game Chat</h1>
    <p className="muted">Join real-time conversations and follow live score updates for teams you follow with an active Pro or Premium Fan membership.</p>
    <div className="actions"><Link href="/membership" className="btn">View Membership</Link><Link href="/teams" className="btn dark">Find Teams</Link></div>
  </section></div></main>;

  return <main className="page-shell"><div className="page-container">
    <header className="topbar"><Link href="/" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/feed">HoopFeed</Link><Link href="/teams">Teams</Link></nav></header>
    <section className="hero-card"><p className="eyebrow">PRO & PREMIUM FAN · LIVE</p><h1>Live Game Chat</h1>
      <p className="muted">Live chat and score changes update automatically for current games involving teams you follow.</p>
      <p className="muted" aria-live="polite">● Connected updates · refreshes every 20 seconds as backup</p>
    </section>
    {!games.length ? <section className="dashboard-card"><h2>No followed team is live right now.</h2>
      <p className="muted">When a followed team's game is marked live, it will appear here automatically. Keep following teams to see their games.</p>
      <Link href="/teams" className="btn">Browse Teams</Link>
    </section> : <section className="live-chat-layout">
      <div className="dashboard-card"><span className="card-kicker">LIVE NOW · {games.length}</span>
        {games.map(game => <button key={game.id} type="button" className={selected?.id === game.id ? "live-game-row selected" : "live-game-row"} onClick={() => setSelected(game)}>
          <strong>{teams[game.team_id]?.name || "Team"}</strong><span>vs {game.opponent_name}</span>
          <b>{game.home_score ?? "—"} : {game.away_score ?? "—"}</b>
        </button>)}
      </div>
      {selected && <div className="dashboard-card live-chat-card">
        <div className="live-chat-header"><div><span className="card-kicker">REAL-TIME CHAT</span><h2>{teams[selected.team_id]?.name || "Team"} vs {selected.opponent_name}</h2></div><strong>🔴 LIVE</strong></div>
        <div className="live-chat-score"><span>{teams[selected.team_id]?.name || "Team"}</span><strong>{selected.home_score ?? "—"} : {selected.away_score ?? "—"}</strong><span>{selected.opponent_name}</span></div>
        <div className="live-chat-messages" aria-live="polite" aria-label="Live game chat messages">
          {messages.map(item => <div className="live-chat-message" key={item.id}><small>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small><span>{item.body}</span></div>)}
          {!messages.length && <p className="muted">You're in. Be the first to react to the game.</p>}
        </div>
        <form className="live-chat-compose" onSubmit={event => { event.preventDefault(); void send(); }}>
          <input value={body} onChange={event => setBody(event.target.value)} maxLength={500} placeholder="React to the game…" aria-label="Chat message" />
          <button className="btn" type="submit" disabled={!body.trim() || sending}>{sending ? "Sending…" : "Send"}</button>
        </form>
        {message && <p className="muted" role="status">{message}</p>}
      </div>}
    </section>}
    <div className="bottom-back"><button className="btn dark" type="button" onClick={() => window.history.back()}>← Back</button></div>
  </div></main>;
}
