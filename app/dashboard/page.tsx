"use client";

import { useEffect, useState } from "react";
import { fetchLeagueSeasons } from "../../lib/league-season-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCachedSession, supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import { useLanguage } from "../../components/LanguageProvider";
import { getHoopCheckEntitlements } from "../../lib/membership-tier";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import { HoopIcon } from "../../components/HoopCheckUI";
import { calculateProfileCompletion } from "../../lib/profile-completion";
import { getPlayerProfileCompletion } from "../../lib/player-profile-completion";
import TeamLogo from "../../components/TeamLogo";
import { getGameAvailability } from "../../lib/game-availability";
import "./home-3.css";

type Profile = {
  id?: string;
  current_country?: string | null;
  favorite_leagues?: string | null;
  height?: string | null;
  free_agent?: boolean | null;
  profile_visibility?: string | null;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  bio?: string | null;
  position?: string | null;
  current_team?: string | null;
  nationality?: string | null;
  hometown?: string | null;
  avatar_url?: string | null;
  player_verified: boolean;
  account_type: "player"|"coach"|"scout"|"agent"|"fan"|"club_admin"|"manager"|"admin";
};
type Team = { id:string; name:string; country:string|null; league_name:string|null };
type HomeGame = { id:string; team_id:string|null; opponent_team_id:string|null; opponent_name:string|null; league_id:string|null; league_name:string|null; status:string; scheduled_at:string|null; started_at?:string|null; ends_at?:string|null; home_score:number|null; away_score:number|null };
type FeedPost = { id:string; body:string; created_at:string; expires_at:string; author_id:string; profiles?:{display_name:string|null}[]|null };

const withTimeout = <T,>(promise: PromiseLike<T>, ms = 8000): Promise<T | null> =>
  Promise.race([Promise.resolve(promise), new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

export default function DashboardPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const basketballSide = useFanBasketballSide();
  const [profile,setProfile] = useState<Profile|null>(null);
  const [email,setEmail] = useState("");
  const [teams,setTeams] = useState<Team[]>([]);
  const [feedPost,setFeedPost] = useState<FeedPost|null>(null);
  const [homeGames,setHomeGames] = useState<HomeGame[]>([]);
  const [teamTrust,setTeamTrust] = useState<{score:number|null;reviewCount:number|null}|null>(null);
  const [ratedTeams,setRatedTeams] = useState<Array<{team:Team;rating:number;count:number}>>([]);
  const [popularTeams,setPopularTeams] = useState<Array<{team:Team;followers:number}>>([]);
  const [canViewTrust,setCanViewTrust] = useState(false);
  const [hasFeedAccess,setHasFeedAccess] = useState(false);
  const [canWriteReviews,setCanWriteReviews] = useState(false);
  const [canUseLiveGames,setCanUseLiveGames] = useState(false);
  const [membershipTier,setMembershipTier] = useState<"free"|"pro"|"premium">("free");
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState(false);
  const [authErrorDetail,setAuthErrorDetail] = useState("");
  const [reloadKey,setReloadKey] = useState(0);
  const [reviewNudgeVisible,setReviewNudgeVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadHome() {
      if(mounted){setLoading(true);setLoadError(false);setAuthErrorDetail("");}
      // Capture auth events as well as session reads. Some browsers can stall a
      // getSession call during token refresh even after SIGNED_IN has fired.
      let resolveAuthEvent: (session: any) => void = () => {};
      const authEvent = new Promise<any>((resolve) => { resolveAuthEvent = resolve; });
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION" || (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED"))) {
          resolveAuthEvent({ data: { session }, error: null });
        }
      });
      const timeoutResult = { data: { session: null }, error: new Error("session-timeout") };
      let sessionResult: any;
      try {
        sessionResult = await Promise.race([
          Promise.resolve(getCachedSession()).then(result => result?.data?.session ? result : authEvent),
          authEvent,
          new Promise(resolve => setTimeout(() => resolve(timeoutResult), 12000))
        ]);
      } catch (error) {
        sessionResult = { data: { session: null }, error };
      } finally {
        authListener.subscription.unsubscribe();
      }
      if (!mounted) return;
      if (sessionResult.error) {
        console.error("Dashboard session check failed:", sessionResult.error);
        setAuthErrorDetail(sessionResult.error?.message === "session-timeout" ? "Your browser did not finish restoring the login session." : "The authentication session could not be restored.");
        setLoadError(true);
        setLoading(false);
        return;
      }
      const user = sessionResult.data?.session?.user;
      if (!user) { router.replace("/login?returnTo=/dashboard"); return; }
      if (!mounted) return;
      setEmail(user.email||"");

      const [profileResult, subscriptionResult, followsResult] = await Promise.allSettled([
        withTimeout(supabase.from("profiles").select("id,display_name,first_name,last_name,bio,position,current_team,current_country,height,free_agent,profile_visibility,nationality,hometown,avatar_url,interests,favorite_leagues,player_verified,account_type").eq("id",user.id).maybeSingle(), 8000),
        withTimeout(supabase.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id",user.id).maybeSingle(), 8000),
        withTimeout(supabase.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","team").order("created_at",{ascending:false}).limit(100), 8000)
      ] as const);
      if (!mounted) return;
      // Optional dashboard data must never turn a valid login into an unavailable dashboard.
      const p = profileResult.status === "fulfilled" ? profileResult.value?.data ?? null : null;
      const subscription = subscriptionResult.status === "fulfilled" ? subscriptionResult.value?.data ?? null : null;
      const follows = followsResult.status === "fulfilled" ? followsResult.value?.data ?? null : null;
      if (profileResult.status === "rejected") console.error("Dashboard profile request failed:", profileResult.reason);
      if (subscriptionResult.status === "rejected") console.error("Dashboard subscription request failed:", subscriptionResult.reason);
      if (followsResult.status === "rejected") console.error("Dashboard follows request failed:", followsResult.reason);
      setProfile(p as Profile|null);
      const entitlements = getHoopCheckEntitlements({ accountType: p?.account_type, subscription, playerVerified: p?.player_verified === true });
      setMembershipTier(entitlements.tier);
      setCanWriteReviews(entitlements.canWriteReviews);
      setCanUseLiveGames(entitlements.canUseLiveGameHub);
      // A dismissed reminder stays hidden for 30 days on this device.
      // Do not show review prompts to fans or players without write access.
      if (entitlements.canWriteReviews) {
        try {
          const dismissedAt = Number(window.localStorage.getItem(`hc-home3-review-nudge:${user.id}`) || 0);
          setReviewNudgeVisible(!dismissedAt || Date.now() - dismissedAt >= 30 * 24 * 60 * 60 * 1000);
        } catch { setReviewNudgeVisible(true); }
      } else setReviewNudgeVisible(false);
      setCanViewTrust(entitlements.canViewTrustScore);
      const followedIds = (follows||[]).map((row:any)=>row.target_id).filter(Boolean);

      // Show the dashboard immediately; the remaining panels are best-effort enhancements.
      setLoading(false);
      setHomeGames([]);
      setFeedPost(null);
      setTeamTrust(null);
      setRatedTeams([]);
      setPopularTeams([]);
      try {
      let visibleTeamIds: string[] = [];
      if (followedIds.length) {
        const teamResult = basketballSide === "womens"
          ? await supabase.from("womens_teams").select("id,name,country,league_name").in("id",followedIds).limit(100)
          : await supabase.from("teams").select("id,name,country,league_name").in("id",followedIds).eq("basketball_type","mens").limit(100);
        if (!mounted) return;
        setTeams((teamResult.data||[]) as Team[]);
        visibleTeamIds = (teamResult.data || []).map(row => row.id);
        // Follow counts are a factual popularity signal, not an invented
        // global trending score. Keep this bounded and independent of fixtures.
        const popularityCandidates = ((teamResult.data || []) as Team[]).slice(0,8);
        void Promise.all(popularityCandidates.map(async team => {
          const result = await withTimeout(supabase.rpc("get_follow_count",{p_target_type:"team",p_target_id:team.id}),5000);
          const followers = Number(result?.data);
          return result && !result.error && Number.isFinite(followers) && followers > 0 ? {team,followers} : null;
        })).then(results => {
          if (mounted) setPopularTeams(results.filter((item):item is {team:Team;followers:number} => item !== null).sort((a,b)=>b.followers-a.followers).slice(0,3));
        }).catch(error=>console.error("Optional team popularity unavailable:",error));
        // A small, factual ranking of followed teams only. Ratings are never
        // fetched for roles without review-summary access, and missing or
        // suppressed review counts are excluded rather than guessed.
        if (entitlements.canReadFullReviews) {
          const candidates = ((teamResult.data || []) as Team[]).slice(0,8);
          // Rankings are optional. Load them independently so slow review RPCs
          // cannot hold up the live-game strip or unified HoopFeed teaser.
          void Promise.all(candidates.map(async team => {
            const result = await withTimeout(basketballSide === "womens"
              ? supabase.rpc("get_womens_review_rating_summary",{p_team_id:team.id})
              : supabase.rpc("get_public_review_summary",{p_entity_type:"team",p_entity_id:team.id}), 5000);
            if (!result || result.error) return null;
            const summary = Array.isArray(result.data) ? result.data[0] : result.data;
            const count = Number(summary?.review_count);
            const rating = Number(summary?.overall_rating);
            if (!Number.isFinite(count) || count < 3 || summary?.overall_rating == null || !Number.isFinite(rating) || rating < 1 || rating > 5) return null;
            return {team,rating,count};
          })).then(summaries => {
            if (mounted) setRatedTeams(summaries.filter((item):item is {team:Team;rating:number;count:number} => item !== null).sort((a,b)=>b.rating-a.rating || b.count-a.count).slice(0,3));
          }).catch(error => console.error("Optional team ratings unavailable:",error));
        }
        if (entitlements.canViewTrustScore && visibleTeamIds.length) {
          const {data:authData} = await supabase.auth.getSession();
          const token = authData.session?.access_token;
          if (token) {
            const params = new URLSearchParams({entityType:basketballSide === "womens" ? "womens-team" : "team",entityId:visibleTeamIds[0]});
            const trustResponse = await fetch(`/api/trust-score?${params}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
            if (trustResponse.ok) {
              const trust = await trustResponse.json();
              if (mounted && !trust.locked) setTeamTrust({score:typeof trust.score === "number" ? trust.score : null,reviewCount:typeof trust.reviewCount === "number" ? trust.reviewCount : null});
            }
          }
        }

      } else {
        setTeams([]);
      }

      const canUsePlayerFeed = entitlements.canReadHoopFeed;
      setHasFeedAccess(canUsePlayerFeed);
      if (canUsePlayerFeed) {
        // HF-5: HoopFeed is one public community — the teaser shows the newest
        // approved community post, not a followers-only, expiring subset.
        const {data:posts} = await supabase.from("feed_posts").select("id,body,created_at,expires_at,author_id,profiles(display_name)").eq("status","approved").order("created_at",{ascending:false}).limit(1);
        if (mounted && posts && posts.length) setFeedPost(posts[0] as FeedPost);
      }

      // Only display fixtures tied to a followed team. Never label global games "YOUR LEAGUE".
      if (entitlements.canUseLiveGameHub && followedIds.length) {
        const {data:games,error:gamesError} = await supabase.from("fan_live_games")
          .select("id,team_id,opponent_team_id,opponent_name,league_id,league_name,status,scheduled_at,started_at,ends_at,home_score,away_score")
          .or(`team_id.in.(${followedIds.join(",")}),opponent_team_id.in.(${followedIds.join(",")})`).in("status",["live","in_progress","scheduled"])
          .order("scheduled_at",{ascending:true}).limit(40);
        if (mounted && !gamesError) {
          const now = Date.now();
          const visibleTeamIdSet = new Set(visibleTeamIds);
          const seasons = await fetchLeagueSeasons((games || []).map(game => game.league_id));
          if (!mounted) return;
          const relevant = ((games || []) as HomeGame[])
            .filter(g => g.league_id && seasons[g.league_id]?.inSeason)
            .filter(g => visibleTeamIdSet.has(g.team_id || "") || visibleTeamIdSet.has(g.opponent_team_id || ""))
            .filter(g => g.status !== "scheduled" || (g.scheduled_at && new Date(g.scheduled_at).getTime() >= now))
            .sort((a,b) => {
              const al = a.status === "live" || a.status === "in_progress";
              const bl = b.status === "live" || b.status === "in_progress";
              return Number(bl) - Number(al) || new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime();
            }).slice(0,6);
          setHomeGames(relevant);
        }
      }
      } catch (error) {
        console.error("Optional dashboard panels failed:", error);
      }
      if (mounted) setLoading(false);
    }
    loadHome().catch((error)=>{console.error("Unable to load HoopCheck home:",error);if(mounted){setLoadError(true);setLoading(false);}});
    return ()=>{mounted=false;};
  },[router,basketballSide,reloadKey]);

  const displayName = profile?.display_name || [profile?.first_name,profile?.last_name].filter(Boolean).join(" ") || email.split("@")[0] || (profile?.account_type === "fan" ? t("fan") : "Player");
  const completion = profile?.account_type === "player" ? getPlayerProfileCompletion(profile).percentage : calculateProfileCompletion(profile).percentage;

  if(loading) return <main className="page-shell dashboard-page"><div className="page-container"><HoopLoading label={t("loadingDashboard")}/></div></main>;

  if(loadError)return <main className="page-shell dashboard-page"><div className="page-container"><div role="alert" className="hc-smooth-inbox-error"><strong>Dashboard unavailable.</strong> {authErrorDetail || "Please try again."} <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:16}}><button type="button" onClick={()=>setReloadKey(v=>v+1)}>Retry dashboard</button><Link href="/login?returnTo=/dashboard">Go to login</Link><Link href="/">Back to home</Link></div></div></div></main>;

  return (
    <main className="page-shell hc-home3">
      <div className="page-container hc-home3-stack">
        <Link href="/search" className="hc-home3-search"><HoopIcon name="search" size={17}/> <span>Search players, coaches, teams, or leagues…</span></Link>
        <section className="hc-home3-greeting">
          <div className="hc-home3-greeting-line"><strong>Welcome back, {displayName}</strong><span className="hc-home3-tier">{membershipTier.toUpperCase()}</span></div>
          <p>Know who you’re signing with.</p>
          {<><div className="hc-home3-completion" role="progressbar" aria-label="Player profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}><span style={{width:`${completion}%`}}/></div><div className="hc-home3-progress-label"><span>{completion === 100 ? "Profile complete" : `Profile ${completion}% — finish for full visibility`}</span>{completion < 100 && <Link href="/account#edit-profile">Finish</Link>}</div></>}
        </section>
        {homeGames.length > 0 && <section className="hc-home3-section"><div className="hc-home3-heading"><h2>YOUR TEAMS — LIVE & NEXT</h2><Link href="/live-games">All games →</Link></div><div className="hc-home3-game-strip">{homeGames.map(game => { const isLive = game.status === "live" || game.status === "in_progress"; const team = teams.find(t => t.id === game.team_id || t.id === game.opponent_team_id); const availability = getGameAvailability({status:game.status,scheduledAt:game.scheduled_at,startedAt:game.started_at,endsAt:game.ends_at}); return <Link key={game.id} href={availability.chatOpen ? `/fan-live?gameId=${encodeURIComponent(game.id)}` : "/live-games"} className="hc-home3-game"><small>{game.league_name || team?.league_name || "Basketball"} · {isLive ? "LIVE" : "UPCOMING"}</small><strong>{team?.name || "Your team"} vs {game.opponent_name || "Opponent"}</strong><span>{isLive ? [game.home_score,game.away_score].every(v => v !== null) ? `${game.home_score} – ${game.away_score}` : "Live now" : game.scheduled_at ? new Date(game.scheduled_at).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "Time TBD"}</span><small>{availability.chatOpen ? "Join game chat →" : availability.opensAt ? `Chat opens ${availability.opensAt.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}` : availability.state === "UPCOMING" ? "Chat opens before tip-off" : availability.state}</small></Link>; })}</div></section>}
        <section className="hc-home3-section"><h2>{language === "es" ? "ACCIONES RÁPIDAS" : "QUICK ACTIONS"}</h2><div className="hc-home3-actions">
          <Link href="/teams"><HoopIcon name="shield-check" size={22}/><span>{language === "es" ? "Consultar un equipo" : "Check a Team"}</span></Link>
          <Link href={canWriteReviews ? "/teams" : profile?.account_type === "fan" || profile?.account_type === "club_admin" || profile?.account_type === "manager" ? "/team-hub" : profile?.account_type === "agent" || profile?.account_type === "scout" ? "/agents-hq" : "/coaches"}><HoopIcon name="edit" size={22}/><span>{canWriteReviews ? (language === "es" ? "Elegir equipo para reseñar" : "Choose Team to Review") : profile?.account_type === "agent" || profile?.account_type === "scout" ? "Agents HQ" : profile?.account_type === "coach" ? (language === "es" ? "Entrenadores" : "Coaches") : (language === "es" ? "Centro de equipos" : "Team Hub")}</span></Link>
          <Link href={profile?.account_type === "agent" || profile?.account_type === "scout" || profile?.account_type === "coach" ? "/players" : profile?.account_type === "club_admin" || profile?.account_type === "manager" ? "/teams" : canUseLiveGames ? "/live-games" : "/players"}><HoopIcon name="basketball" size={22}/><span>{profile?.account_type === "agent" || profile?.account_type === "scout" || profile?.account_type === "coach" ? (language === "es" ? "Jugadores" : "Players") : profile?.account_type === "club_admin" || profile?.account_type === "manager" ? (language === "es" ? "Equipos" : "Teams") : canUseLiveGames ? (language === "es" ? "Partidos en vivo" : "Live Games") : (language === "es" ? "Jugadores" : "Players")}</span></Link>
          <Link href={profile?.account_type === "agent" || profile?.account_type === "scout" ? "/coaches" : profile?.account_type === "coach" ? "/teams" : profile?.account_type === "club_admin" || profile?.account_type === "manager" ? "/account" : "/team-hub"}><HoopIcon name="users" size={22}/><span>{profile?.account_type === "agent" || profile?.account_type === "scout" ? (language === "es" ? "Entrenadores" : "Coaches") : profile?.account_type === "coach" ? (language === "es" ? "Equipos" : "Teams") : profile?.account_type === "club_admin" || profile?.account_type === "manager" ? (language === "es" ? "Cuenta" : "Account") : (language === "es" ? "Grupos de aficionados" : "Fan Groups")}</span></Link>
        </div></section>
        {popularTeams.length > 0 && <section className="hc-home3-section"><div className="hc-home3-heading"><h2>POPULAR — TEAMS YOU FOLLOW</h2><Link href="/teams">Explore teams →</Link></div><div className="hc-home3-rated-list">{popularTeams.map(({team,followers})=><Link key={team.id} href={`${basketballSide === "womens" ? "/womens" : "/teams"}/${team.id}`} className="hc-home3-rated-team"><span>{team.name}<small>{team.league_name || team.country || "Basketball"}</small></span><strong>{followers.toLocaleString()}<small>followers</small></strong></Link>)}</div></section>}
        {ratedTeams.length > 0 && <section className="hc-home3-section"><div className="hc-home3-heading"><h2>TOP RATED — TEAMS YOU FOLLOW</h2><Link href="/teams">Explore teams →</Link></div><div className="hc-home3-rated-list">{ratedTeams.map(({team,rating,count})=><Link key={team.id} href={`${basketballSide === "womens" ? "/womens" : "/teams"}/${team.id}`} className="hc-home3-rated-team"><span>{team.name}<small>{team.league_name || team.country || "Basketball"}</small></span><strong>{rating.toFixed(1)}/5 <small>({count} reviews)</small></strong></Link>)}</div></section>}
        {canWriteReviews && reviewNudgeVisible && <section className="hc-home3-review-nudge" aria-label="Review reminder"><div><strong>Played for a team recently?</strong><p>Share your experience to help the next player make an informed decision.</p></div><div className="hc-home3-nudge-actions"><Link href="/teams">Choose a team to review</Link><button type="button" aria-label="Dismiss review reminder for 30 days" onClick={() => { try { if(profile?.id) window.localStorage.setItem(`hc-home3-review-nudge:${profile.id}`, String(Date.now())); } catch {} setReviewNudgeVisible(false); }}>Dismiss</button></div></section>}
        {(feedPost || (!hasFeedAccess && profile?.account_type !== "fan")) && <section className="hc-home3-section"><div className="hc-home3-heading"><h2>FROM THE COMMUNITY</h2><Link href="/feed">Open HoopFeed →</Link></div>
          {hasFeedAccess && feedPost ? <Link href="/feed" className="hc-home3-post"><strong>{feedPost.profiles?.[0]?.display_name || "Community member"}</strong><p>{feedPost.body}</p></Link> : !hasFeedAccess && profile?.account_type !== "fan" ? <Link href="/membership" className="hc-home3-post">HoopFeed is available with Pro or Premium. View membership →</Link> : null}
        </section>}
        {teams.length > 0 ? <section className="hc-home3-section"><h2>YOUR TEAM</h2><Link href={(basketballSide === "womens" ? "/womens/" : "/teams/") + teams[0].id} className="hc-home3-team"><TeamLogo name={teams[0].name} size={34}/><div className="hc-home3-team-details"><strong>{teams[0].name}</strong>{canViewTrust && teamTrust && <small>{teamTrust.score !== null ? `Trust ${teamTrust.score}/100` : "Trust score unavailable"}{teamTrust.reviewCount !== null ? ` · ${teamTrust.reviewCount} reviews` : ""}</small>}</div><span>Team page →</span></Link></section> : <Link href="/teams" className="hc-home3-team">Find your team →</Link>}
        <footer className="hc-home3-footer">Every league. Every level. Real reviews, one community.</footer>
      </div>
    </main>
  );
}
