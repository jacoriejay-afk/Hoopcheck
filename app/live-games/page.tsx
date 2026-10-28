"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FanBasketballSideSwitch from "../../components/FanBasketballSideSwitch";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import SearchBar from "../../components/SearchBar";
import CourtLines from "../../components/CourtLines";
import { getGameAvailability, formatViewerLocalTime } from "../../lib/game-availability";
import { HoopIcon } from "../../components/HoopCheckUI";
import "./live-games-chat.css";

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
type Team = { id: string; name: string; logo_url?: string | null; country?: string | null; league_name?: string | null };
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

const COUNTRY_FLAGS: Record<string, string> = {
  "united states": "🇺🇸", "usa": "🇺🇸", "united kingdom": "🇬🇧", "uk": "🇬🇧",
  "azerbaijan": "🇦🇿", "turkey": "🇹🇷", "türkiye": "🇹🇷", "germany": "🇩🇪",
  "france": "🇫🇷", "spain": "🇪🇸", "italy": "🇮🇹", "greece": "🇬🇷",
  "serbia": "🇷🇸", "croatia": "🇭🇷", "slovenia": "🇸🇮", "lithuania": "🇱🇹",
  "latvia": "🇱🇻", "estonia": "🇪🇪", "poland": "🇵🇱", "ukraine": "🇺🇦",
  "romania": "🇷🇴", "bulgaria": "🇧🇬", "portugal": "🇵🇹", "netherlands": "🇳🇱",
  "belgium": "🇧🇪", "sweden": "🇸🇪", "finland": "🇫🇮", "denmark": "🇩🇰",
  "norway": "🇳🇴", "iceland": "🇮🇸", "austria": "🇦🇹", "switzerland": "🇨🇭",
  "czechia": "🇨🇿", "czech republic": "🇨🇿", "slovakia": "🇸🇰", "hungary": "🇭🇺",
  "cyprus": "🇨🇾", "israel": "🇮🇱", "japan": "🇯🇵", "australia": "🇦🇺",
  "new zealand": "🇳🇿", "canada": "🇨🇦", "mexico": "🇲🇽", "brazil": "🇧🇷",
  "argentina": "🇦🇷", "chile": "🇨🇱", "south korea": "🇰🇷", "china": "🇨🇳",
  "qatar": "🇶🇦", "saudi arabia": "🇸🇦", "united arab emirates": "🇦🇪",
  "georgia": "🇬🇪", "armenia": "🇦🇲", "kosovo": "🇽🇰", "montenegro": "🇲🇪",
  "north macedonia": "🇲🇰", "bosnia and herzegovina": "🇧🇦", "ireland": "🇮🇪",
};
function countryFlag(country: string) {
  return COUNTRY_FLAGS[country.trim().toLocaleLowerCase()] || "🌍";
}
function countryAnchor(country: string) {
  return `country-${country.toLocaleLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown"}`;
}

export default function LiveGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);
  const [presenceCounts, setPresenceCounts] = useState<Record<string, number>>({});
  const [joinedGameIds, setJoinedGameIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [leagueFilter, setLeagueFilter] = useState("");
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reminding, setReminding] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const basketballSide = useFanBasketballSide();

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
    const rawGames = (gamesResult.data || []) as Game[];
    const candidateIds = Array.from(new Set(rawGames.flatMap(game => [game.team_id, game.opponent_team_id].filter((id): id is string => Boolean(id)))));
    const { data: sideRows } = candidateIds.length ? await supabase.from("teams").select("id").in("id", candidateIds).eq("basketball_type", basketballSide === "womens" ? "womens" : "mens") : { data: [] as {id:string}[] };
    const sideIds = new Set((sideRows || []).map((row:any) => row.id));
    const nextGames = rawGames.filter(game => sideIds.has(game.team_id));
    const follows = (followsResult.data || []).map((row: {target_id:string}) => row.target_id);
    setFollowedIds(follows);
    setGames(nextGames);
    setReminders((remindersResult.data || []).map((row: {game_id:string}) => row.game_id));

    const ids = Array.from(new Set(nextGames.flatMap(game => [game.team_id, game.opponent_team_id].filter((id): id is string => Boolean(id)))));
    if (ids.length) {
      const { data: teamRows } = await supabase.from("teams").select("id,name,logo_url,country,league_name").in("id", ids);
      setTeams(Object.fromEntries((teamRows || []).map((team: Team) => [team.id, team])));
    } else setTeams({});

    const freshAfter = new Date(Date.now() - 75_000).toISOString();
    const { data: presenceRows } = await supabase.from("fan_live_chat_presence")
      .select("game_id,user_id,last_seen_at").gt("last_seen_at", freshAfter);
    const counts: Record<string, number> = {};
    for (const row of presenceRows || []) counts[row.game_id] = (counts[row.game_id] || 0) + 1;
    setPresenceCounts(counts);
    setJoinedGameIds(new Set((presenceRows || []).filter((row: any) => row.user_id === user.id).map((row: any) => row.game_id)));
    setLoading(false);
  }, [basketballSide]);

  useEffect(() => { void load(true); }, [load]);
  useEffect(() => {
    const presenceChannel = supabase.channel("live-games-presence-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "fan_live_chat_presence" }, () => { void load(); })
      .subscribe();
    const refresh = window.setInterval(() => {
      setClock(new Date());
      void load();
    }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") { setClock(new Date()); void load(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(refresh); document.removeEventListener("visibilitychange", onVisible); void supabase.removeChannel(presenceChannel); };
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
    if (search && ![home?.name, away?.name, game.opponent_name, leagueName, game.country, home?.country, away?.country].some(value => value?.toLocaleLowerCase().includes(search))) return false;
    return true;
  }), [prepared, leagueFilter, filter, followedIds, query, teams]);

  const nowMs = clock.getTime();
  const live = filtered.filter(({game,availability}) =>
    !["final","finished","cancelled","canceled","postponed","abandoned"].includes(game.status.toLowerCase()) &&
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
      Number.isFinite(timestamp) && timestamp >= nowMs - 48 * 3_600_000;
  }).sort((a,b) => Date.parse(b.game.ends_at || b.game.started_at || b.game.scheduled_at || "") - Date.parse(a.game.ends_at || a.game.started_at || a.game.scheduled_at || ""));

  const postGameOpen = filtered.filter(({availability,game}) => availability.phase === "post-game" && availability.chatOpen && !["final","finished","cancelled","canceled","postponed","abandoned"].includes(game.status.toLowerCase()));

  const nextUpcoming = upcoming[0] || null;

  const countryGroups = useMemo(() => {
    const byCountry = new Map<string, { country: string; live: typeof live; upcoming: typeof upcoming; recent: typeof recent; postGame: typeof postGameOpen }>();
    const countryFor = (entry: typeof prepared[number]) =>
      (entry.game.country || entry.home?.country || entry.away?.country || "Country not listed").trim() || "Country not listed";
    const ensure = (country: string) => {
      if (!byCountry.has(country)) byCountry.set(country, { country, live: [], upcoming: [], recent: [], postGame: [] });
      return byCountry.get(country)!;
    };
    live.forEach(entry => ensure(countryFor(entry)).live.push(entry));
    upcoming.forEach(entry => ensure(countryFor(entry)).upcoming.push(entry));
    recent.forEach(entry => ensure(countryFor(entry)).recent.push(entry));
    postGameOpen.forEach(entry => ensure(countryFor(entry)).postGame.push(entry));
    return Array.from(byCountry.values()).sort((a, b) =>
      Number(b.live.length > 0) - Number(a.live.length > 0) ||
      (b.live.length + b.upcoming.length) - (a.live.length + a.upcoming.length) ||
      a.country.localeCompare(b.country)
    );
  }, [live, upcoming, recent, postGameOpen, prepared]);

  const countryLeagueGroups = (entries: typeof upcoming) => {
    const groups = new Map<string, typeof upcoming>();
    entries.forEach(entry => {
      const league = entry.game.league_name || teams[entry.game.team_id]?.league_name || "League not listed";
      if (!groups.has(league)) groups.set(league, []);
      groups.get(league)!.push(entry);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  };

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
    const canJoin = availability.chatOpen && !isRecent && !["final","finished","cancelled","canceled","postponed","abandoned"].includes(game.status.toLowerCase()) && (!isUpcoming || Boolean(game.scheduled_at && Date.parse(game.scheduled_at) <= nowMs));
    const score = scoreText(game);
    const tip = game.scheduled_at || game.started_at;
    return (
      <article className={`hc-live-hub-card ${isLive ? "is-live" : ""} ${isRecent ? "is-recent" : ""}`}>
        <div className="hc-live-hub-card__top">
          {isLive ? <span className="hc-live-badge hc-live-badge--visible"><span aria-hidden="true">●</span> LIVE</span>
            : variant === "postgame" ? <span className="hc-live-state hc-live-state--post">POST-GAME CHAT</span>
            : isRecent ? <span className="hc-live-state">FINAL</span>
            : availability.state === "OPENS SOON" ? <span className="hc-live-state hc-live-state--soon">OPENS SOON</span>
            : <span className="hc-live-state">UPCOMING</span>}
          <span className="hc-live-card__league">{leagueName}{country ? ` · ${country}` : ""}</span>
        </div>
        <div className="hc-live-card__teams">
          <div className="hc-live-card__side">
            <span className="hc-live-card__crest hc-live-team-logo" aria-hidden="true">{home?.logo_url ? <img src={home.logo_url} alt="" onError={e => { e.currentTarget.style.display = "none"; }} /> : null}<span>{initials(home?.name || "Team")}</span></span>
            <strong>{home?.name || "Team"}</strong>
          </div>
          <div className="hc-live-card__middle">
            {score ? <strong className="hc-live-card__score">{score}</strong> : <span className="hc-live-card__vs">VS</span>}
            {game.period_label && <small>{game.period_label}</small>}
          </div>
          <div className="hc-live-card__side hc-live-card__side--away">
            <span className="hc-live-card__crest hc-live-team-logo" aria-hidden="true">{away?.logo_url ? <img src={away.logo_url} alt="" onError={e => { e.currentTarget.style.display = "none"; }} /> : null}<span>{initials(away?.name || game.opponent_name)}</span></span>
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
          {canJoin && <Link href={`/fan-live?gameId=${encodeURIComponent(game.id)}`} className="btn hc-live-join">{joinedGameIds.has(game.id) ? "IN CHAT ✓" : "JOIN CHAT"} <span aria-hidden="true">→</span></Link>}
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

  return <main className="page-shell hc-live-hub-page">
      <FanBasketballSideSwitch /><div className="page-container">
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

        <section className="hc-live-country-browser" aria-label="Games by country">
      <div className="hc-live-section-heading"><div><p className="eyebrow">WORLDWIDE TIP-OFFS</p><h2>BROWSE BY COUNTRY <span>{countryGroups.length}</span></h2></div><p>Live games appear first inside each country, followed by upcoming fixtures grouped by league.</p></div>
      {countryGroups.length > 0 && <nav className="hc-live-country-index" aria-label="Jump to country">
        <span className="hc-live-country-index__label">JUMP TO</span>
        {countryGroups.map(group => <a key={group.country} href={`#${countryAnchor(group.country)}`} title={group.country}>{countryFlag(group.country)} <span>{group.country}</span></a>)}
      </nav>}
      {countryGroups.length ? countryGroups.map(group => (
        <section className="hc-live-country-section" id={countryAnchor(group.country)} key={group.country} aria-label={`${group.country} games`}>
          <header className="hc-live-country-heading">
            <div className="hc-live-country-heading__name"><span className="hc-live-country-flag" aria-hidden="true">{countryFlag(group.country)}</span><div><h3>{group.country}</h3><p>{group.live.length} live · {group.upcoming.length} upcoming</p></div></div>
            <a href="#top" className="hc-live-country-top">Back to top ↑</a>
          </header>
          {group.live.length > 0 && <div className="hc-live-country-block">
            <div className="hc-live-country-subheading"><h4><span className="hc-live-dot" /> LIVE NOW</h4><span>{group.live.length}</span></div>
            <div className="hc-live-hub-grid">{group.live.map(entry => <GameCard key={entry.game.id} entry={entry} variant="live" />)}</div>
          </div>}
          {group.postGame.length > 0 && <div className="hc-live-country-block">
            <div className="hc-live-country-subheading"><h4>POST-GAME CHAT</h4><span>{group.postGame.length}</span></div>
            <div className="hc-live-hub-grid">{group.postGame.map(entry => <GameCard key={entry.game.id} entry={entry} variant="postgame" />)}</div>
          </div>}
          {group.upcoming.length > 0 && <div className="hc-live-country-block">
            <div className="hc-live-country-subheading"><h4>UPCOMING BY LEAGUE</h4><span>{group.upcoming.length}</span></div>
            {countryLeagueGroups(group.upcoming).map(([league, entries]) => <section className="hc-live-country-league" key={league} aria-label={league}>
              <h5>{league}<span>{entries.length}</span></h5>
              <div className="hc-live-hub-grid">{entries.map(entry => <GameCard key={entry.game.id} entry={entry} variant="upcoming" />)}</div>
            </section>)}
          </div>}
          {group.recent.length > 0 && <div className="hc-live-country-block">
            <div className="hc-live-country-subheading"><h4>RECENTLY FINISHED</h4><span>{group.recent.length}</span></div>
            {countryLeagueGroups(group.recent).map(([league, entries]) => <section className="hc-live-country-league" key={league} aria-label={league}>
              <h5>{league}<span>{entries.length}</span></h5>
              <div className="hc-live-hub-grid">{entries.map(entry => <GameCard key={entry.game.id} entry={entry} variant="recent" />)}</div>
            </section>)}
          </div>}
        </section>
      )) : <div className="hc-live-empty"><div className="hc-live-empty__icon"><HoopIcon name="basketball" size={24} /></div><div><h3>{games.length ? "No games match these filters" : "No games scheduled yet"}</h3><p>{games.length ? "Try another country, team, league, or filter." : "The game schedule has no fixtures yet. Games will appear by country when schedule data is available."}</p>{nextUpcoming && <button type="button" className={`hc-remind-button ${reminders.includes(nextUpcoming.game.id) ? "is-set" : ""}`} disabled={reminding===nextUpcoming.game.id} onClick={() => void toggleReminder(nextUpcoming.game.id)}><HoopIcon name="bell" size={16}/>{reminders.includes(nextUpcoming.game.id) ? "REMINDER SET" : "REMIND ME"}</button>}</div></div>}
    </section>
    {!filtered.length && <section className="hc-live-no-games"><CourtLines variant="circle" className="hc-court-empty-art" /><h2>{games.length ? "No games match these filters" : "No games scheduled yet"}</h2><p>{games.length ? "Try another country, team, league, or filter — or browse the full team directory." : "The game schedule has no fixtures yet. Browse the team directory while the schedule feed is being populated."}</p><Link href="/teams" className="btn">Browse Teams</Link></section>}
        <div className="hc-live-hub-footer"><span>Game states refresh automatically every 60 seconds.</span><Link href="/teams">Explore teams <span aria-hidden="true">→</span></Link></div>
  </div></main>;
}
