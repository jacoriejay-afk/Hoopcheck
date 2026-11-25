"use client";
import { getEffectiveMembership } from "../../lib/billing/client-membership";

import { useCallback, useEffect, useMemo, useState } from "react";
import FanBasketballSideSwitch from "../../components/FanBasketballSideSwitch";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import CourtLines from "../../components/CourtLines";
import { getGameAvailability, formatViewerLocalTime, formatPregameCountdown, getViewerUpcomingTimeBucket } from "../../lib/game-availability";
import { getLiveGameStatusPresentation } from "../../lib/live-game-status";
import { scoreSnapshotFreshness } from "../../lib/hoopdata-ingestion";
import { HoopIcon } from "../../components/HoopCheckUI";
import TeamLogo from "../../components/TeamLogo";
import GameWinnerPrediction from "../../components/GameWinnerPrediction";
import "../game-predictions.css";
import "./live-games-chat.css";
import { getHoopCheckEntitlements } from "../../lib/membership-tier";

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
  score_updated_at?: string | null;
};
type Team = { id: string; name: string; logo_url?: string | null; logo_bg?: "transparent" | "light" | "dark" | null; country?: string | null; league_name?: string | null };
type Filter = "live" | "upcoming" | "my-teams";



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
  const [presenceObservedAt, setPresenceObservedAt] = useState<number | null>(null);
  const [joinedGameIds, setJoinedGameIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("live");
  const [collapsedLeagues, setCollapsedLeagues] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [countryFocus, setCountryFocus] = useState("");
  const [leagueFocus, setLeagueFocus] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reminding, setReminding] = useState<string | null>(null);
  const [expandedPredictionId, setExpandedPredictionId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const basketballSide = useFanBasketballSide();

  const load = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setUserId(null); setAllowed(false); setGames([]); setPresenceCounts({}); setJoinedGameIds(new Set()); setPresenceObservedAt(null); setLoading(false); return;
    }
    setUserId(user.id);
    const [{ data: profile }, { data: subscription, error: membershipError }] = await Promise.all([
      supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
      getEffectiveMembership(user.id),
    ]);
    const entitlements = getHoopCheckEntitlements({ accountType: profile?.account_type, subscription });
    if (membershipError) { setAllowed(false); setGames([]); setPresenceCounts({}); setJoinedGameIds(new Set()); setPresenceObservedAt(null); setLoading(false); setMessage("Membership could not be verified. Refresh to retry; your billing has not changed."); return; }
    const isAllowed = entitlements.canUseLiveGameHub;
    setAllowed(isAllowed);
    if (!isAllowed) { setGames([]); setPresenceCounts({}); setJoinedGameIds(new Set()); setPresenceObservedAt(null); setLoading(false); return; }

    // Older deployments without the freshness column still show schedules, but never imply a fresh score.
    const gameFields = "id,team_id,opponent_team_id,opponent_name,status,home_score,away_score,started_at,ends_at,scheduled_at,league_id,league_name,country,period_label" as const;
    const readGames = (fields: typeof gameFields | `${typeof gameFields},score_updated_at`) => supabase.from("fan_live_games")
        .select(fields)
        .in("status", ["scheduled", "live", "final", "cancelled", "postponed", "abandoned"])
        // Query the relevant time window BEFORE applying the row limit.
        // Otherwise older historical fixtures crowd out today's live games.
        .gte("scheduled_at", new Date(Date.now() - 48 * 3_600_000).toISOString())
        .lte("scheduled_at", new Date(Date.now() + 7 * 86_400_000).toISOString())
        .order("scheduled_at", { ascending: true, nullsFirst: false }).limit(1000);
    const readGamesWithFreshness = async () => {
      const result = await readGames((gameFields + ",score_updated_at") as `${typeof gameFields},score_updated_at`);
      return result.error?.code === "42703" ? readGames(gameFields) : result;
    };
    const [followsResult, gamesResult, remindersResult] = await Promise.all([
      supabase.from("follow_relationships").select("target_id").eq("follower_id", user.id).eq("target_type", "team").limit(500),
      readGamesWithFreshness(),
      supabase.from("fan_live_game_reminders").select("game_id").eq("user_id", user.id),
    ]);
    if (gamesResult.error) setMessage("Game schedules are temporarily unavailable. Please refresh in a moment.");
    else { setLastCheckedAt(new Date()); setMessage(""); }
    const rawGames = (gamesResult.data || []) as unknown as Game[]; // Fixed field allowlist; generated types may predate score_updated_at.
    const candidateIds = Array.from(new Set(rawGames.flatMap(game => [game.team_id, game.opponent_team_id].filter((id): id is string => Boolean(id)))));
    const [{ data: sideRows }, { data: womensSideRows }] = await Promise.all([
      candidateIds.length
        ? supabase.from("teams").select("id").in("id", candidateIds).eq("basketball_type", basketballSide === "womens" ? "womens" : "mens")
        : Promise.resolve({ data: [] as {id:string}[] }),
      basketballSide === "womens" && candidateIds.length
        ? supabase.from("womens_teams").select("id").in("id", candidateIds)
        : Promise.resolve({ data: [] as {id:string}[] }),
    ]);
    const sideIds = new Set([...(sideRows || []), ...(womensSideRows || [])].map((row:any) => row.id));
    const nextGames = rawGames.filter(game => sideIds.has(game.team_id) || sideIds.has(game.opponent_team_id || ""));
    const follows = (followsResult.data || []).map((row: {target_id:string}) => row.target_id);
    setFollowedIds(follows);
    setGames(nextGames);
    setReminders((remindersResult.data || []).map((row: {game_id:string}) => row.game_id));

    const ids = Array.from(new Set(nextGames.flatMap(game => [game.team_id, game.opponent_team_id].filter((id): id is string => Boolean(id)))));
    if (ids.length) {
      const [{ data: teamRows }, { data: womensTeamRows }] = await Promise.all([
        supabase.from("teams").select("id,name,logo_url,logo_bg,country,league_name").in("id", ids),
        basketballSide === "womens"
          ? supabase.from("womens_teams").select("id,name,logo_url,logo_bg,country,league_name").in("id", ids)
          : Promise.resolve({ data: [] as Team[] }),
      ]);
      setTeams(Object.fromEntries([...(teamRows || []), ...(womensTeamRows || [])].map((team: Team) => [team.id, team])));
    } else setTeams({});

    const freshAfter = new Date(Date.now() - 75_000).toISOString();
    const observedAt = Date.now();
    const { data: presenceRows, error: presenceError, count: presenceTotal } = await supabase.from("fan_live_chat_presence")
      .select("game_id,user_id,last_seen_at", { count: "exact" }).gt("last_seen_at", freshAfter);
    if (presenceError || !presenceRows || presenceTotal !== presenceRows.length) {
      setPresenceCounts({}); setJoinedGameIds(new Set()); setPresenceObservedAt(null); setLoading(false); return;
    }
    setPresenceObservedAt(observedAt);
    const counts: Record<string, number> = {};
    for (const row of presenceRows || []) counts[row.game_id] = (counts[row.game_id] || 0) + 1;
    setPresenceCounts(counts);
    setJoinedGameIds(new Set((presenceRows || []).filter((row: any) => row.user_id === user.id).map((row: any) => row.game_id)));
    setLoading(false);
  }, [basketballSide]);

  useEffect(() => {
    // Supabase requests can stall on mobile networks or an expired preview session.
    // Never leave the hub on an indefinite loading screen.
    const watchdog = window.setTimeout(() => {
      setMessage("Live Games took too long to load. Check your connection and try again.");
      setLoading(false);
    }, 15000);
    void load(true).catch(() => {
      setMessage("Live Games could not load. Please retry.");
      setLoading(false);
    }).finally(() => window.clearTimeout(watchdog));
    return () => window.clearTimeout(watchdog);
  }, [load]);
  useEffect(() => {
    const presenceChannel = supabase.channel("live-games-presence-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "fan_live_chat_presence" }, () => { void load(); })
      .subscribe();
    // Listen for provider-backed score changes when fan_live_games is published to
    // Realtime. The regular 60-second refresh remains the fallback if it is not.
    const gameChangesChannel = supabase.channel("live-games-score-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "fan_live_games" }, () => { void load(); })
      .subscribe();
    const refresh = window.setInterval(() => {
      setClock(new Date());
      void load();
    }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") { setClock(new Date()); void load(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(refresh); document.removeEventListener("visibilitychange", onVisible); void supabase.removeChannel(presenceChannel); void supabase.removeChannel(gameChangesChannel); };
  }, [load]);

  const presenceFresh = presenceObservedAt !== null && clock.getTime() - presenceObservedAt < 75_000;
  const prepared = useMemo(() => games.map(game => ({
    game,
    presentation: getLiveGameStatusPresentation(game, clock),
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

  // Activity ordering uses provider status and real chat presence, never
  // invented popularity metrics. Limit choices so mobile users needn't scroll.
  const discoveryShortcuts = useMemo(() => {
    const countries = new Map<string, { games: number; activity: number }>();
    const leagues = new Map<string, { games: number; activity: number }>();
    for (const { game, home, presentation } of prepared) {
      const country = game.country || home?.country || "";
      const league = game.league_name || home?.league_name || "";
      const activity = (presenceFresh ? (presenceCounts[game.id] || 0) * 4 : 0) + (presentation.isVerifiedLive ? 8 : 0);
      for (const [name, map] of [[country, countries], [league, leagues]] as const) {
        if (!name) continue;
        const existing = map.get(name) || { games: 0, activity: 0 };
        map.set(name, { games: existing.games + 1, activity: existing.activity + activity });
      }
    }
    const top = (items: Map<string, { games: number; activity: number }>) =>
      [...items.entries()].sort((a,b) => b[1].activity - a[1].activity || b[1].games - a[1].games || a[0].localeCompare(b[0]))
        .slice(0, 7).map(([name, counts]) => ({ name, games: counts.games }));
    return { countries: top(countries), leagues: top(leagues) };
  }, [prepared, presenceCounts, presenceFresh]);

  const filtered = useMemo(() => prepared.filter(({game,home,away,availability}) => {
    const leagueName = game.league_name || teams[game.team_id]?.league_name || "";
    const gameCountry = game.country || home?.country || "";
    if (countryFocus && gameCountry !== countryFocus) return false;
    if (leagueFocus && leagueName !== leagueFocus) return false;

    const search = query.trim().toLocaleLowerCase();
    if (search && ![home?.name, away?.name, game.opponent_name, leagueName, game.country, home?.country, away?.country].some(value => value?.toLocaleLowerCase().includes(search))) return false;
    return true;
  }), [prepared, query, teams, countryFocus, leagueFocus]);

  const nowMs = clock.getTime();
  // Chat availability is not proof that a match has started. Only provider LIVE status earns the badge.
  const live = filtered.filter(({game,availability,presentation}) =>
    game.status.toLowerCase() === "live" && presentation.isVerifiedLive && availability.state === "LIVE" &&
    availability.phase !== "post-game" && availability.phase !== "closed");
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
  // Retain overdue provider records for inspection without calling them LIVE or FINAL.
  const delayedLive = filtered.filter(({game,presentation}) =>
    game.status.toLowerCase() === "live" && presentation.isUnverified);
  const nextUpcoming = upcoming[0] || null;

  async function refreshNow() {
    if (refreshing) return;
    setRefreshing(true);
    try { await load(); setClock(new Date()); }
    catch { setMessage("Could not refresh games. The last loaded scores may be out of date."); }
    finally { setRefreshing(false); }
  }

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

  function GameCard({ entry, variant, allowPredictions = true }: { entry: typeof prepared[number]; variant: "live" | "upcoming" | "recent" | "postgame" | "delayed"; allowPredictions?: boolean }) {
    const {game,availability,home,away,presentation} = entry;
    const leagueName = game.league_name || teams[game.team_id]?.league_name || "League not listed";
    const country = game.country || teams[game.team_id]?.country || "";
    const isLive = variant === "live" && presentation.isVerifiedLive;
    const isUpcoming = variant === "upcoming";
    const isRecent = variant === "recent";
    const canJoin = availability.chatOpen && !presentation.isUnverified && !["cancelled","canceled","postponed","abandoned"].includes(game.status.toLowerCase()) && (!presentation.isVerifiedFinal || process.env.NEXT_PUBLIC_LIVE_POSTGAME_CHAT_ENABLED === "true");
    const score = scoreText(game);
    const tip = game.scheduled_at || game.started_at;
    const countdown = isUpcoming && !presentation.isUnverified ? formatPregameCountdown(game.status, game.scheduled_at, clock) : null;
    return (
      <article className={`hc-live-hub-card ${isLive ? "is-live" : ""} ${isRecent ? "is-recent" : ""}`}>
        <div className="hc-live-hub-card__top">
          {presentation.isUnverified ? <span className="hc-live-state">{presentation.label}</span>
            : isLive ? <span className="hc-live-badge hc-live-badge--visible"><span aria-hidden="true">●</span> LIVE</span>
            : variant === "postgame" ? <span className="hc-live-state hc-live-state--post">POST-GAME CHAT</span>
            : isRecent ? <span className="hc-live-state">FINAL</span>
            : availability.state === "OPENS SOON" ? <span className="hc-live-state hc-live-state--soon">OPENS SOON</span>
            : <span className="hc-live-state">UPCOMING</span>}
          <span className="hc-live-card__league">{leagueName}{country ? ` · ${country}` : ""}</span>
        </div>
        <div className="hc-live-card__teams">
          <div className="hc-live-card__side">
            <TeamLogo name={home?.name || "Team"} logoUrl={home?.logo_url} logoBg={home?.logo_bg} size={44} className="hc-live-card__crest hc-live-team-logo" />
            <strong>{home?.name || "Team"}</strong>
          </div>
          <div className="hc-live-card__middle">
            {score ? <strong className="hc-live-card__score">{score}</strong> : <span className="hc-live-card__vs">VS</span>}
            {presentation.showPeriod && game.period_label && <small>{game.period_label}</small>}
          </div>
          <div className="hc-live-card__side hc-live-card__side--away">
            <TeamLogo name={away?.name || game.opponent_name} logoUrl={away?.logo_url} logoBg={away?.logo_bg} size={44} className="hc-live-card__crest hc-live-team-logo" />
            <strong>{away?.name || game.opponent_name}</strong>
          </div>
        </div>
        <div className="hc-live-card__meta">
          {availability.chatOpen && allowed && presenceFresh && presenceCounts[game.id] > 0 && <span><HoopIcon name="users" size={15} /> {presenceCounts[game.id]} {presenceCounts[game.id] === 1 ? "member chatting" : "members chatting"}</span>}
          {isUpcoming && <span><HoopIcon name="calendar" size={15} /> {formatViewerLocalTime(tip)}</span>}
          {countdown && <span>{countdown}</span>}
          {isRecent && <span><HoopIcon name="check" size={15} /> {presentation.isUnverified ? "Waiting for provider-confirmed result" : availability.chatOpen ? "Post-game conversation" : "Final score"}</span>}
          {variant === "postgame" && <span><HoopIcon name="message-square" size={15} /> Post-game chat remains open</span>}
          {isLive && <span aria-label="Score source">{scoreSnapshotFreshness(game.score_updated_at, clock) === "delayed" ? "Score update delayed" : scoreSnapshotFreshness(game.score_updated_at, clock) === "unknown" ? "Score freshness unavailable" : "Provider-reported live score"}</span>}
        </div>
        {presentation.isUnverified && <p className="hc-live-card__muted">Last reported score · Result/status not verified</p>}
        {isUpcoming && availability.opensAt && <p className="hc-live-card__muted">{availability.minutesUntilOpen && availability.minutesUntilOpen > 0 ? `Chat opens in ${availability.minutesUntilOpen} min` : "Chat open"} · {formatViewerLocalTime(availability.opensAt.toISOString(), { weekday: undefined })}</p>}
        <div className="hc-live-card__actions">
          <Link href={`/fan-live/room/${encodeURIComponent(game.id)}`} className={canJoin?"btn hc-live-join":"hc-live-room-view"} aria-label={(canJoin?"Join":"View")+" game chat for "+(home?.name||"Home")+" versus "+(away?.name||game.opponent_name)}>{canJoin?(presenceFresh && joinedGameIds.has(game.id)?"IN CHAT ✓":"JOIN CHAT"):"VIEW ROOM"} <span aria-hidden="true">→</span></Link>
          {isUpcoming && <button type="button" className={`hc-remind-button ${reminders.includes(game.id) ? "is-set" : ""}`} disabled={reminding === game.id} onClick={() => void toggleReminder(game.id)}>
            <HoopIcon name="bell" size={16} /> {reminding === game.id ? "Saving…" : reminders.includes(game.id) ? "REMINDER SET" : "REMIND ME"}
          </button>}
          {isRecent && !canJoin && <span className="hc-live-card__muted">{presentation.isUnverified ? "Last reported score" : "Final score"} {score || "not available"}</span>}
          {allowPredictions && game.opponent_team_id && !["cancelled", "canceled", "postponed", "abandoned"].includes(game.status.toLowerCase()) &&
            <button type="button" className="hc-remind-button"
              aria-expanded={expandedPredictionId === game.id}
              onClick={() => setExpandedPredictionId(open => open === game.id ? null : game.id)}>
              <HoopIcon name="trophy" size={16} /> {expandedPredictionId === game.id ? "HIDE FAN PICKS" : "FAN PICKS"}
            </button>}
          <Link href={(basketballSide === "womens" ? "/womens/" : "/teams/") + game.team_id} className="hc-live-card__muted">Team profile</Link>
        </div>
        {allowPredictions && game.opponent_team_id && expandedPredictionId === game.id &&
          <div className="hc-live-card__prediction">
            <GameWinnerPrediction game={game} homeName={home?.name || "Home"} awayName={away?.name || game.opponent_name} />
          </div>}
      </article>
    );
  }

  if (loading) return <main className="page-shell hc-live-hub-page"><div className="page-container"><HoopLoading label="Loading Live Games..." /></div></main>;
  if (!userId) return <main className="page-shell hc-live-hub-page"><div className="page-container"><section className="hero-card"><p className="eyebrow">LIVE GAME HUB</p><h1>LIVE GAME CHAT</h1><p className="muted">Sign in to discover live and upcoming games and join game conversations.</p><Link href="/login" className="btn">Sign in</Link></section></div></main>;
  if (!allowed) return <main className="page-shell hc-live-hub-page"><div className="page-container"><section className="hero-card"><p className="eyebrow">PRO & PREMIUM MEMBERS</p><h1>MEMBERSHIP REQUIRED</h1><p className="muted">Watch together. Follow live and upcoming games, and join the conversation.</p><p className="muted">An active Pro or Premium membership is required to open the Live Game Hub and join game chats.</p><Link href="/membership" className="btn">Explore Membership</Link></section></div></main>;

  return <main className="page-shell hc-live-hub-page">
      <FanBasketballSideSwitch /><div className="page-container">
    <section aria-label="Courtside pulse" className="hc-live-hub-section">
      <div className="hc-live-section-heading"><div><p className="eyebrow">COURTSIDE PULSE</p><h2>{live.length} live {live.length === 1 ? "game" : "games"} · {presenceFresh ? `${live.reduce((total, entry) => total + (presenceCounts[entry.game.id] || 0), 0)} fans in live chats` : "Fan activity unavailable"}</h2><p className="muted">LIVE reflects the game provider, not just an open chat. Schedules and conversations update independently.</p></div>
        <button type="button" className="btn dark" disabled={refreshing} onClick={() => void refreshNow()}>{refreshing ? "Checking…" : "Refresh games"}</button></div>
      <p className="muted" role="status">{lastCheckedAt ? "Scores last checked " + lastCheckedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + " · Individual score freshness depends on the provider." : "Score source not checked yet."}</p>
    </section>
    <section aria-label="Happening Now" className="hc-live-hub-section hc-live-active-rooms">
      <div className="hc-live-section-heading"><div><p className="eyebrow">ACTIVE CHAT ROOMS</p><h2>Happening now</h2></div><Link href="/fan-live" className="hc-live-directory-link">Browse rooms →</Link></div>
      <div className="hc-live-conversations-rail">
        {filtered.filter(({game,availability,presentation}) => presenceFresh && !presentation.isUnverified && availability.chatOpen && (presenceCounts[game.id] || 0) > 0)
          .sort((a,b) => (presenceCounts[b.game.id] || 0) - (presenceCounts[a.game.id] || 0))
          .slice(0,8).map(({game,home,away}) =>
            <Link key={game.id} href={`/fan-live/room/${encodeURIComponent(game.id)}`} className="hc-live-conversation-link">
              <span>{home?.name||"Home"} vs {away?.name||game.opponent_name}</span>
              <small>{presenceCounts[game.id]} chatting · Open →</small>
            </Link>)}
        {!filtered.some(({game,availability,presentation}) => presenceFresh && !presentation.isUnverified && availability.chatOpen && (presenceCounts[game.id] || 0)>0) &&
          <p className="muted">{presenceFresh ? "No active rooms yet. Start the conversation from a matchup below." : "Room activity is temporarily unavailable. You can still browse matchups below."}</p>}
      </div>
    </section>
    <section className="hc-live-hub-filters" aria-label="Browse game conversations">
      <div className="hc-live-hub-filter-tabs">
        {([{value:"live",label:"Live Now"},{value:"upcoming",label:"Upcoming"},{value:"my-teams",label:"My Teams"}] as const).map(option =>
          <button key={option.value} type="button" className={filter===option.value ? "is-active" : ""} onClick={() => setFilter(option.value)}>{option.label}</button>
        )}
      </div>
      <div className="hc-live-hub-filter-tools">
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search teams, leagues, countries…" aria-label="Search games" className="hc-live-hub-search" />
      </div>
      {(countryFocus || leagueFocus || query) && <button type="button" className="hc-live-clear-filters" onClick={() => { setCountryFocus(""); setLeagueFocus(""); setQuery(""); }}>Clear all filters</button>}
      <details className="hc-live-discovery-toggle"><summary>Browse countries &amp; leagues</summary><div className="hc-live-discovery" aria-label="Browse games by activity and region">
        {discoveryShortcuts.countries.length > 1 && <div className="hc-live-shortcut-section">
          <strong>Countries with fixtures</strong>
          <div className="hc-live-shortcut-chips">
            {discoveryShortcuts.countries.map(({name,games}) => <button key={name} type="button" aria-pressed={countryFocus === name}
              onClick={() => setCountryFocus(current => current === name ? "" : name)} title={name + ": " + games + " fixtures"}>
              {name} <span>{games}</span>
            </button>)}
          </div>
        </div>}
        {discoveryShortcuts.leagues.length > 1 && <div className="hc-live-shortcut-section">
          <strong>Leagues to browse</strong>
          <div className="hc-live-shortcut-chips">
            {discoveryShortcuts.leagues.map(({name,games}) => <button key={name} type="button" aria-pressed={leagueFocus === name}
              onClick={() => setLeagueFocus(current => current === name ? "" : name)} title={name + ": " + games + " fixtures"}>
              {name} <span>{games}</span>
            </button>)}
          </div>
        </div>}
      </div></details>
    </section>
    {message && <p className="hc-live-hub-message" role="status">{message}</p>}

    {(() => {
      const selected = filter === "upcoming" ? upcoming : filter === "my-teams"
        ? filtered.filter(({game}) => followedIds.includes(game.team_id) || Boolean(game.opponent_team_id && followedIds.includes(game.opponent_team_id)))
        : [...live, ...delayedLive, ...postGameOpen, ...recent];
      const ordered = [...selected].sort((a,b) => {
        const mineA = followedIds.includes(a.game.team_id) || Boolean(a.game.opponent_team_id && followedIds.includes(a.game.opponent_team_id));
        const mineB = followedIds.includes(b.game.team_id) || Boolean(b.game.opponent_team_id && followedIds.includes(b.game.opponent_team_id));
        return Number(mineB) - Number(mineA)
          || (presenceFresh ? (presenceCounts[b.game.id] || 0) - (presenceCounts[a.game.id] || 0) : 0)
          || Date.parse(a.game.scheduled_at || "") - Date.parse(b.game.scheduled_at || "");
      });
      const groups = new Map<string, typeof prepared>();
      for (const entry of ordered) {
        const country = entry.game.country || entry.home?.country || "Other countries";
        const league = entry.game.league_name || entry.home?.league_name || "Other leagues";
        const timeBucket = filter === "upcoming" ? getViewerUpcomingTimeBucket(entry.game.scheduled_at, clock) : "";
        const key = (timeBucket ? timeBucket + " · " : "") + country + " / " + league;
        groups.set(key, [...(groups.get(key) || []), entry]);
      }
      return <section className="hc-live-hub-section" aria-label={filter === "my-teams" ? "My team games" : filter === "upcoming" ? "Upcoming games" : "Live conversations"}>
        {!ordered.length && <p className="muted">No games in this segment right now.</p>}
        {[...groups.entries()].map(([key, entries]) => <section key={key} className="hc-live-hub-section">
          <button type="button" aria-expanded={!collapsedLeagues.includes(key)} className="hc-live-section-heading" onClick={() => setCollapsedLeagues(current => current.includes(key) ? current.filter(value => value !== key) : [...current,key])}>
            <strong>{key}</strong><span>{entries.length} games {collapsedLeagues.includes(key) ? "＋" : "−"}</span>
          </button>
          {!collapsedLeagues.includes(key) && <div className="hc-live-hub-grid">{entries.map(entry =>
            <GameCard key={entry.game.id} entry={entry} variant={entry.presentation.isUnverified ? "delayed" : live.some(item => item.game.id === entry.game.id) ? "live" : ["final","finished"].includes(entry.game.status.toLowerCase()) ? "recent" : entry.availability.phase === "post-game" ? "postgame" : "upcoming"} />)}</div>}
        </section>)}
      </section>;
    })()}

    {!filtered.length && <section className="hc-live-no-games"><CourtLines variant="circle" className="hc-court-empty-art" /><h2>{games.length ? "No games match these filters" : "No games scheduled yet"}</h2><p>{games.length ? "Try another team, league, or filter — or browse the full team directory." : "The game schedule has no fixtures yet. Browse the team directory while the schedule feed is being populated."}</p><Link href="/teams" className="btn">Browse Teams</Link></section>}
    <div className="hc-live-hub-footer"><span>Game data is checked every 60 seconds while this page is open; actual provider updates may be less frequent.</span><Link href="/teams">Explore teams <span aria-hidden="true">→</span></Link></div>
  </div></main>;
}
