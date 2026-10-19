"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import SearchBar from "../../components/SearchBar";
import CourtLines from "../../components/CourtLines";
import { getGameAvailability, formatViewerLocalTime } from "../../lib/game-availability";
import { HoopIcon } from "../../components/HoopCheckUI";

type Game = {
  id: string;
  team_id: string;
  opponent_team_id: string | null;
  opponent_name: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  started_at: string | null;
  ends_at: string | null;
  scheduled_at: string | null;
  league_id: string | null;
  league_name: string | null;
  country: string | null;
  period_label: string | null;
};
type Team = { id: string; name: string; country?: string | null; league_name?: string | null };
type Filter = "all" | "live" | "my-teams";

const activeSubscription = (subscription: {plan?: string|null;status?: string|null;current_period_end?: string|null} | null) =>
  !!subscription &&
  (subscription.plan === "pro" || subscription.plan === "premium") &&
  (subscription.status === "active" || subscription.status === "trialing") &&
  (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "HC";
}

function scoreText(game: Game) {
  return game.home_score !== null && game.away_score !== null
    ? `${game.home_score} – ${game.away_score}`
    : null;
}

export default function LiveGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);
  const [presenceCounts, setPresenceCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [leagueFilter, setLeagueFilter] = useState("");
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reminding, setReminding] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());

  const load = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setUserId(null); setAllowed(false); setGames([]); setLoading(false); return;
    }
    setUserId(user.id);
    const [{ data: profile }, { data: subscription }] = await Promise.all([
      supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status,current_period_end").eq("user_id", user.id).maybeSingle(),
    ]);
    const isAllowed = profile?.account_type === "fan" && activeSubscription(subscription);
    setAllowed(isAllowed);
    if (!isAllowed) { setGames([]); setLoading(false); return; }

    const [followsResult, gamesResult, remindersResult] = await Promise.all([
      supabase.from("follow_relationships").select("target_id").eq("follower_id", user.id).eq("target_type", "team").limit(500),
      supabase.from("fan_live_games")
        .select("id,team_id,opponent_team_id,opponent_name,status,home_score,away_score,started_at,ends_at,scheduled_at,league_id,league_name,country,period_label")
        .in("status", ["scheduled", "live", "final", "cancelled", "postponed", "abandoned"])
        .order("scheduled_at", { ascending: true, nullsFirst: false }).limit(500),
      supabase.from("fan_live_game_reminders").select("game_id").eq("user_id", user.id),
    ]);
    if (gamesResult.error) setMessage("Game schedules are temporarily unavailable. Please refresh in a moment.");
    const nextGames = (gamesResult.data || []) as Game[];
    const follows = (followsResult.data || []).map((row: {target_id:string}) => row.target_id);
    setFollowedIds(follows);
    setGames(nextGames);
    setReminders((remindersResult.data || []).map((row: {game_id:string}) => row.game_id));

    const ids = Array.from(new Set(nextGames.flatMap(game => [game.team_id, game.opponent_team_id].filter((id): id is string => Boolean(id)))));
    if (ids.length) {
      const { data: teamRows } = await supabase.from("teams").select("id,name,country,league_name").in("id", ids);
      setTeams(Object.fromEntries((teamRows || []).map((team: Team) => [team.id, team])));
    } else setTeams({});

    const freshAfter = new Date(Date.now() - 90_000).toISOString();
    const { data: presenceRows } = await supabase.from("fan_live_chat_presence")
      .select("game_id,last_seen_at").gt("last_seen_at", freshAfter);
    const counts: Record<string, number> = {};
    for (const row of presenceRows || []) counts[row.game_id] = (counts[row.game_id] || 0) + 1;
    setPresenceCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { void load(true); }, [load]);
  useEffect(() => {
    const refresh = window.setInterval(() => {
      setClock(new Date());
      void load();
    }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") { setClock(new Date()); void load(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(refresh); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  const prepared = useMemo(() => games.map(game => ({
    game,
    availability: getGameAvailability({
      status: game.status,
      scheduledAt: game.scheduled_at,
      startedAt: game.started_at,
      endsAt: game.ends_at,
      now: clock,
    }),
    home: teams[game.team_id],
    away: teams[game.opponent_team_id || ""] || { id: game.opponent_team_id || "", name: game.opponent_name },
  })), [games, teams, clock]);

  const leagues = useMemo(() => Array.from(new Set(prepared.map(({game}) => game.league_name || teams[game.team_id]?.league_name).filter((value): value is string => Boolean(value)))).sort(), [prepared, teams]);
  const filtered = useMemo(() => prepared.filter(({game,home,away,availability}) => {
    const leagueName = game.league_name || teams[game.team_id]?.league_name || "";
    if (leagueFilter && leagueName !== leagueFilter) return false;
    if (filter === "live" && !(availability.state === "LIVE" && availability.phase !== "post-game")) return false;
    if (filter === "my-teams" && !followedIds.some(id => id === game.team_id || id === game.opponent_team_id)) return false;
    const search = query.trim().toLocaleLowerCase();
    if (search && ![home?.name, away?.name, game.opponent_name, leagueName].some(value => value?.toLocaleLowerCase().includes(search))) return false;
    return true;
  }), [prepared, leagueFilter, filter, followedIds, query, teams]);

  const nowMs = clock.getTime();
  const live = filtered.filter(({game,availability}) =>
    availability.state === "LIVE" && availability.phase !== "post-game" &&
    (game.status === "live" || availability.phase === "schedule-unknown"));
  const upcoming = filtered.filter(({availability,game}) => {
    if (!(availability.state === "UPCOMING" || availability.state === "OPENS SOON")) return false;
    const tip = game.scheduled_at ? Date.parse(game.scheduled_at) : Number.NaN;
    return !Number.isFinite(tip) || (tip >= nowMs && tip <= nowMs + 7 * 86_400_000);
  }).sort((a,b) => {
    const ta = Date.parse(a.game.scheduled_at || a.game.started_at || "");
    const tb = Date.parse(b.game.scheduled_at || b.game.started_at || "");
    return (Number.isFinite(ta) ? ta : Number.MAX_SAFE_INTEGER) - (Number.isFinite(tb) ? tb : Number.MAX_SAFE_INTEGER);
  });
  const recent = filtered.filter(({game,availability}) => {
    const status = game.status.toLowerCase();
    const timestamp = Date.parse(game.ends_at || game.started_at || game.scheduled_at || "");
    return ["final","finished","cancelled","canceled"].includes(status) &&
      Number.isFinite(timestamp) && timestamp >= nowMs - 48 * 3_600_000 &&
      availability.state === "CLOSED";
  }).sort((a,b) => Date.parse(b.game.ends_at || b.game.started_at || b.game.scheduled_at || "") - Date.parse(a.game.ends_at || a.game.started_at || a.game.scheduled_at || ""));

  const postGameOpen = filtered.filter(({availability}) => availability.phase === "post-game" && availability.chatOpen);
  const nextUpcoming = upcoming[0] || null;

  async function toggleReminder(gameId: string) {
    if (!userId || reminding) return;
    setReminding(gameId); setMessage("");
    const existing = reminders.includes(gameId);
    const result = existing
      ? await supabase.from("fan_live_game_reminders").delete().eq("user_id", userId).eq("game_id", gameId)
      : await supabase.from("fan_live_game_reminders").insert({ user_id: userId, game_id: gameId });
    if (result.error) setMessage("We couldn't update that reminder. Please try again.");
    else setReminders(current => existing ? current.filter(id => id !== gameId) : [...current, gameId]);
    setReminding(null);
  }

  function GameCard({ entry, variant }: { entry: typeof prepared[number]; variant: "live" | "upcoming" | "recent" | "postgame" }) {
    const {game,availability,home,away} = entry;
    const leagueName = game.league_name || teams[game.team_id]?.league_name || "League not listed";
    const country = game.country || teams[game.team_id]?.country || "";
    const isLive = variant === "live";
    const isUpcoming = variant === "upcoming";
    const isRecent = variant === "recent";
    const canJoin = availability.chatOpen && !isRecent && (!isUpcoming || Boolean(game.scheduled_at && Date.parse(game.scheduled_at) <= nowMs));
    const score = scoreText(game);
    const tip = game.scheduled_at || game.started_at;
    return (
      <article className={`hc-live-hub-card ${isLive ? "is-live" : ""} ${isRecent ? "is-recent" : ""}`}>
        <div className="hc-live-hub-card__top">
          {isLive ? <span className="hc-live-badge"><span aria-hidden="true">●</span> LIVE</span>
            : variant === "postgame" ? <span className="hc-live-state hc-live-state--post">POST-GAME CHAT</span>
            : isRecent ? <span className="hc-live-state">FINAL</span>
            : availability.state === "OPENS SOON" ? <span className="hc-live-state hc-live-state--soon">OPENS SOON</span>
            : <span className="hc-live-state">UPCOMING</span>}
          <span className="hc-live-card__league">{leagueName}{country ? ` · ${country}` : ""}</span>
        </div>
        <div className="hc-live-card__teams">
          <div className="hc-live-card__side">
            <span className="hc-live-card__crest" aria-hidden="true">{initials(home?.name || "Team")}</span>
            <strong>{home?.name || "Team"}</strong>
          </div>
          <div className="hc-live-card__middle">
            {score ? <strong className="hc-live-card__score">{score}</strong> : <span className="hc-live-card__vs">VS</span>}
            {game.period_label && <small>{game.period_label}</small>}
          </div>
          <div className="hc-live-card__side hc-live-card__side--away">
            <span className="hc-live-card__crest" aria-hidden="true">{initials(away?.name || game.opponent_name)}</span>
            <strong>{away?.name || game.opponent_name}</strong>
          </div>
        </div>
        <div className="hc-live-card__meta">
          {isLive && <span><HoopIcon name="users" size={15} /> {presenceCounts[game.id] || 0} {presenceCounts[game.id] === 1 ? "fan chatting" : "fans chatting"}</span>}
          {isUpcoming && <span><HoopIcon name="calendar" size={15} /> {formatViewerLocalTime(tip)}</span>}
          {isRecent && <span><HoopIcon name="check" size={15} /> Chat closed</span>}
          {variant === "postgame" && <span><HoopIcon name="message-square" size={15} /> Post-game chat remains open</span>}
        </div>
        {isUpcoming && availability.opensAt && <p className="hc-live-card__muted">Chat opens {formatViewerLocalTime(availability.opensAt.toISOString(), { weekday: undefined })} · Remind Me sends an in-app reminder.</p>}
        <div className="hc-live-card__actions">
          {canJoin && <Link href={`/fan-live?gameId=${encodeURIComponent(game.id)}`} className="btn hc-live-join">{isUpcoming ? "JOIN CHAT" : "JOIN CHAT"} <span aria-hidden="true">→</span></Link>}
          {isUpcoming && <button type="button" className={`hc-remind-button ${reminders.includes(game.id) ? "is-set" : ""}`} disabled={reminding === game.id} onClick={() => void toggleReminder(game.id)}>
            <HoopIcon name="bell" size={16} /> {reminding === game.id ? "Saving…" : reminders.includes(game.id) ? "REMINDER SET" : "REMIND ME"}
          </button>}
          {isRecent && <span className="hc-live-card__muted">Final score {score || "not available"}</span>}
        </div>
      </article>
    );
  }

  if (loading) return <main className="page-shell hc-live-hub-page"><div className="page-container"><HoopLoading label="Loading Live Games..." /></div></main>;
  if (!userId) return <main className="page-shell hc-live-hub-page"><div className="page-container"><section className="hero-card"><p className="eyebrow">FAN COMMUNITY</p><h1>LIVE GAME CHAT</h1><p className="muted">Sign in as a Pro or Premium Fan to discover games and join live conversations.</p><Link href="/login" className="btn">Sign in</Link></section></div></main>;
  if (!allowed) return <main className="page-shell hc-live-hub-page"><div className="page-container"><section className="hero-card"><p className="eyebrow">PRO & PREMIUM FANS</p><h1>LIVE GAME CHAT</h1><p className="muted">Watch together. Chat live with fans during real games.</p><p className="muted">An active Pro or Premium Fan membership is required to join live game chat.</p><Link href="/membership" className="btn">Explore Membership</Link></section></div></main>;

  return <main className="page-shell hc-live-hub-page"><div className="page-container">
    <header className="hc-live-hub-hero">
      <div><p className="eyebrow">HOOPCHECK · FAN HQ</p><h1>LIVE GAME CHAT<span>.</span></h1><p>Watch together. Chat live with fans during real games.</p></div>
      <div className="hc-live-hero-orbit" aria-hidden="true"><span /><span /><span /></div>
    </header>

    <section className="hc-live-hub-filters" aria-label="Filter games">
      <div className="hc-live-hub-filter-tabs">
        {([{value:"all",label:"All games"},{value:"live",label:"Live only"},{value:"my-teams",label:"My teams"}] as const).map(option =>
          <button key={option.value} type="button" className={filter===option.value ? "is-active" : ""} onClick={() => setFilter(option.value)}>{option.label}</button>
        )}
      </div>
      <div className="hc-live-hub-filter-tools">
        <SearchBar value={query} onChange={setQuery} onSubmit={() => {}} placeholder="Search teams or leagues…" ariaLabel="Search games by team or league" buttonLabel="Search" className="hc-live-hub-search" />
        <label className="hc-live-league-select"><span>League</span><select value={leagueFilter} onChange={event => setLeagueFilter(event.target.value)}><option value="">All leagues</option>{leagues.map(league => <option key={league} value={league}>{league}</option>)}</select></label>
      </div>
    </section>
    {message && <p className="hc-live-hub-message" role="status">{message}</p>}

    <section className="hc-live-hub-section">
      <div className="hc-live-section-heading"><div><p className="eyebrow">RIGHT NOW</p><h2>LIVE NOW <span>{live.length}</span></h2></div><p>Real-time conversations, one game at a time.</p></div>
      {live.length ? <div className="hc-live-hub-grid">{live.map(entry => <GameCard key={entry.game.id} entry={entry} variant="live" />)}</div>
        : <div className="hc-live-empty"><div className="hc-live-empty__icon"><HoopIcon name="basketball" size={24} /></div><div><h3>No live games right now</h3>{upcoming[0] ? <><p>Next tip-off: {formatViewerLocalTime(upcoming[0].game.scheduled_at || upcoming[0].game.started_at)}. Set a reminder and we’ll keep it on your list.</p><div className="hc-live-empty__actions"><button type="button" className={`hc-remind-button ${reminders.includes(upcoming[0].game.id) ? "is-set" : ""}`} disabled={reminding===upcoming[0].game.id} onClick={() => void toggleReminder(upcoming[0].game.id)}><HoopIcon name="bell" size={16}/>{reminders.includes(upcoming[0].game.id) ? "REMINDER SET" : "REMIND ME"}</button></div></> : <p>When a game is live, its chat will appear here. There are no confirmed upcoming tip-off times yet.</p>}</div></div>}
      {postGameOpen.length > 0 && <><div className="hc-live-section-heading hc-live-post-heading"><div><p className="eyebrow">STAY IN THE CONVERSATION</p><h2>POST-GAME CHAT <span>{postGameOpen.length}</span></h2></div></div><div className="hc-live-hub-grid">{postGameOpen.map(entry => <GameCard key={entry.game.id} entry={entry} variant="postgame" />)}</div></>}
    </section>

    <section className="hc-live-hub-section">
      <div className="hc-live-section-heading"><div><p className="eyebrow">NEXT UP</p><h2>UPCOMING <span>{upcoming.length}</span></h2></div><p>Tip-off times are shown in your local timezone.</p></div>
      {upcoming.length ? <div className="hc-live-hub-grid">{upcoming.map(entry => <GameCard key={entry.game.id} entry={entry} variant="upcoming" />)}</div>
        : <div className="hc-live-empty"><div className="hc-live-empty__icon"><HoopIcon name="calendar" size={24} /></div><div><h3>No confirmed upcoming games</h3><p>There are no scheduled fixtures in the current game feed yet. We’ll show them here when the provider supplies confirmed tip-off times.</p></div></div>}
    </section>

    <section className="hc-live-hub-section hc-live-recent-section">
      <div className="hc-live-section-heading"><div><p className="eyebrow">FINAL WHISTLE</p><h2>RECENTLY FINISHED <span>{recent.length}</span></h2></div><p>Games from the last 48 hours.</p></div>
      {recent.length ? <div className="hc-live-hub-grid">{recent.map(entry => <GameCard key={entry.game.id} entry={entry} variant="recent" />)}</div>
        : <div className="hc-live-recent-empty">Recent final scores will appear here when available.</div>}
    </section>

    {!filtered.length && <section className="hc-live-no-games"><CourtLines variant="circle" className="hc-court-empty-art" /><h2>{games.length ? "No games match these filters" : "No games scheduled yet"}</h2><p>{games.length ? "Try another team, league, or filter — or browse the full team directory." : "The game schedule has no fixtures yet. Browse the team directory while the schedule feed is being populated."}</p><Link href="/teams" className="btn">Browse Teams</Link></section>}
    <div className="hc-live-hub-footer"><span>Game states refresh automatically every 60 seconds.</span><Link href="/teams">Explore teams <span aria-hidden="true">→</span></Link></div>
  </div></main>;
}
