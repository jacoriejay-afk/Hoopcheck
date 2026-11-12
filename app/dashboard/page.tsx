"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCachedSession, supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import HomePulse from "../../components/HomePulse";
import SearchBar from "../../components/SearchBar";
import { useLanguage } from "../../components/LanguageProvider";
import { getHoopCheckEntitlements } from "../../lib/membership-tier";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import { CategoryIconTile, HoopIcon } from "../../components/HoopCheckUI";
import { calculateProfileCompletion } from "../../lib/profile-completion";
import TeamLogo from "../../components/TeamLogo";
import PlayerProfileCompletionCard from "../../components/PlayerProfileCompletionCard";
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
  account_type: "player"|"coach"|"scout"|"agent"|"fan";
};
type Team = { id:string; name:string; country:string|null; league_name:string|null };
type Review = { id:string; team_id:string; title:string|null; body:string; overall_rating:number; created_at:string };
type FeedPost = { id:string; body:string; created_at:string; expires_at:string; author_id:string; profiles?:{display_name:string|null}[]|null };

const withTimeout = <T,>(promise: PromiseLike<T>, ms = 8000): Promise<T | null> =>
  Promise.race([Promise.resolve(promise), new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const basketballSide = useFanBasketballSide();
  const [profile,setProfile] = useState<Profile|null>(null);
  const [email,setEmail] = useState("");
  const [teams,setTeams] = useState<Team[]>([]);
  const [reviews,setReviews] = useState<Review[]>([]);
  const [feedPost,setFeedPost] = useState<FeedPost|null>(null);
  const [liveCounts,setLiveCounts] = useState<{live:number|null;upcoming:number|null}>({live:null,upcoming:null});
  const [hasFeedAccess,setHasFeedAccess] = useState(false);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState(false);
  const [authErrorDetail,setAuthErrorDetail] = useState("");
  const [reloadKey,setReloadKey] = useState(0);

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
        withTimeout(supabase.from("subscriptions").select("plan,status,access_status").eq("user_id",user.id).maybeSingle(), 8000),
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
      const entitlements = getHoopCheckEntitlements({ accountType: p?.account_type, subscription });
      const followedIds = (follows||[]).map((row:any)=>row.target_id).filter(Boolean);

      // Show the dashboard immediately; the remaining panels are best-effort enhancements.
      setLoading(false);
      try {
      if (followedIds.length) {
        const teamResult = basketballSide === "womens"
          ? await supabase.from("womens_teams").select("id,name,country,league_name").in("id",followedIds).limit(100)
          : await supabase.from("teams").select("id,name,country,league_name").in("id",followedIds).eq("basketball_type","mens").limit(100);
        if (!mounted) return;
        setTeams((teamResult.data||[]) as Team[]);
        if (p?.account_type !== "fan") {
          const {data:reviewRows} = await supabase.from("reviews").select("id,team_id,title,body,overall_rating,created_at").in("team_id",followedIds).eq("status","approved").order("created_at",{ascending:false}).limit(3);
          if (!mounted) return;
          setReviews((reviewRows||[]) as Review[]);
        }
      } else {
        setTeams([]);
        setReviews([]);
      }

      const canUsePlayerFeed = entitlements.canReadHoopFeed;
      setHasFeedAccess(canUsePlayerFeed);
      if (canUsePlayerFeed) {
        // HF-5: HoopFeed is one public community — the teaser shows the newest
        // approved community post, not a followers-only, expiring subset.
        const {data:posts} = await supabase.from("feed_posts").select("id,body,created_at,expires_at,author_id,profiles(display_name)").eq("status","approved").order("created_at",{ascending:false}).limit(1);
        if (mounted && posts && posts.length) setFeedPost(posts[0] as FeedPost);
      }

      if (entitlements.canUseLiveGameHub && p?.account_type === "fan") {
        const {data:games,error:gamesError} = await supabase.from("fan_live_games").select("status,scheduled_at").in("status",["live","scheduled"]).order("scheduled_at",{ascending:true}).limit(200);
        const now = Date.now();
        if (mounted && !gamesError) setLiveCounts({live:(games||[]).filter((g:any)=>g.status==="live").length,upcoming:(games||[]).filter((g:any)=>g.status==="scheduled" && (!g.scheduled_at || new Date(g.scheduled_at).getTime()>=now)).length});
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
  const completion = calculateProfileCompletion(profile).percentage;

  if(loading) return <main className="page-shell dashboard-page"><div className="page-container"><HoopLoading label={t("loadingDashboard")}/></div></main>;

  if(loadError)return <main className="page-shell dashboard-page"><div className="page-container"><div role="alert" className="hc-smooth-inbox-error"><strong>Dashboard unavailable.</strong> {authErrorDetail || "Please try again."} <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:16}}><button type="button" onClick={()=>setReloadKey(v=>v+1)}>Retry dashboard</button><Link href="/login?returnTo=/dashboard">Go to login</Link><Link href="/">Back to home</Link></div></div></div></main>;

  if(profile?.account_type==="fan") return (
    <main className="page-shell hc-ia-home hc-dashboard-compact"><div className="page-container">
      <header className="hc-ia-welcome hc-home-hero"><p className="eyebrow">{t("home.fanEyebrow")}</p><h1>{t("home.fanTitle")}<span>.</span></h1><p className="muted">{t("home.fanDescription")}</p><div className="hc-ia-identity"><span className="hc-ia-avatar">{displayName.charAt(0).toUpperCase()}</span><span><small>{t("home.signedIn")}</small><strong>{displayName}</strong></span></div></header>
      <HomePulse live={liveCounts.live} upcoming={liveCounts.upcoming} followedClubs={teams.length} fan/>
      {teams.length > 0 ? <section className="hc-ia-section hc-ia-your-clubs">
        <div className="hc-ia-section-heading"><div><p className="eyebrow">YOUR CLUBS</p><h2>Teams you follow</h2></div><Link href="/team-hub">Open Team Hub <HoopIcon name="arrow-right" size={15}/></Link></div>
        <div className="hc-ia-fan-grid">{teams.slice(0,4).map(team => <Link key={team.id} href={basketballSide === "womens" ? `/womens/${team.id}` : `/teams/${team.id}`} className="hc-ia-door"><TeamLogo name={team.name} size={40} className="hc-live-team-logo"/><span><strong>{team.name}</strong><small>{[team.league_name,team.country].filter(Boolean).join(" · ") || "Basketball club"}</small></span><HoopIcon name="chevron-right" size={18}/></Link>)}</div>
      </section> : <section className="hc-ia-section hc-ia-your-clubs">
        <p className="eyebrow">START YOUR FAN HQ</p><h2>Follow your first club</h2>
        <p className="muted">Choose a team to personalize your scores, club updates and fan conversations.</p>
        <Link href={basketballSide === "womens" ? "/womens" : "/teams"} className="btn">Explore {basketballSide === "womens" ? "women's" : "men's"} teams</Link>
      </section>}
      <section className="hc-ia-section"><h2>{t("home.fanSide")}</h2><div className="hc-ia-fan-grid">
        <Link href="/team-hub" className="hc-ia-door"><CategoryIconTile category="teams" size="sm"/><span><strong>{t("home.teamHub")}</strong><small>{t("home.teamHubDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
        <Link href="/fan-feed" className="hc-ia-door"><CategoryIconTile category="reviews" size="sm"/><span><strong>{t("home.fanFeed")}</strong><small>{t("home.fanFeedDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
        <Link href="/fans" className="hc-ia-door"><CategoryIconTile category="reviews" icon="users" size="sm"/><span><strong>{t("home.findFan")}</strong><small>{t("home.findFanDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
        <Link href="/fan-live" className="hc-ia-door"><CategoryIconTile category="leagues" size="sm"/><span><strong>{t("home.liveGames")}</strong><small>{liveCounts.live===null?"Open the live game hub":`${liveCounts.live} live · ${liveCounts.upcoming ?? "—"} upcoming`}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
      </div></section>
      <Link href="/account" className="hc-ia-account-link">{t("home.accountSettings")} <HoopIcon name="arrow-right" size={16}/></Link>
    </div></main>
  );

  return (
    <main className="page-shell hc-home3">
      <div className="page-container hc-home3-stack">
        <Link href="/search" className="hc-home3-search"><HoopIcon name="search" size={17}/> <span>Search players, coaches, teams, or leagues…</span></Link>
        <section className="hc-home3-greeting">
          <div className="hc-home3-greeting-line"><strong>Welcome back, {displayName}</strong><span className="hc-home3-tier">{profile?.account_type?.toUpperCase() || "PLAYER"}</span></div>
          <p>Know who you’re signing with.</p>
          {completion < 100 && <><div className="hc-home3-completion"><span style={{width:`${completion}%`}}/></div><div className="hc-home3-progress-label"><span>Profile {completion}% — finish for full visibility</span><Link href="/account#edit-profile">Finish</Link></div></>}
        </section>
        {liveCounts.live !== null && (liveCounts.live > 0 || (liveCounts.upcoming ?? 0) > 0) && <section className="hc-home3-section"><h2>YOUR LEAGUE — LIVE & NEXT</h2><Link href="/live-games" className="hc-home3-live"><span className="hc-ia-live-dot"/> {liveCounts.live} live · {liveCounts.upcoming} upcoming <span>View games →</span></Link></section>}
        <section className="hc-home3-section"><h2>QUICK ACTIONS</h2><div className="hc-home3-actions">
          <Link href="/teams"><HoopIcon name="shield-check" size={22}/><span>Check a Team</span></Link>
          <Link href="/reviews"><HoopIcon name="pencil-line" size={22}/><span>Review a Team</span></Link>
          <Link href="/live-games"><HoopIcon name="radio" size={22}/><span>Live Games</span></Link>
          <Link href="/team-hub"><HoopIcon name="users" size={22}/><span>Fan Groups</span></Link>
        </div></section>
        <section className="hc-home3-section"><div className="hc-home3-heading"><h2>FROM THE COMMUNITY</h2><Link href="/feed">Open HoopFeed →</Link></div>
          {hasFeedAccess && feedPost ? <Link href="/feed" className="hc-home3-post"><strong>{feedPost.profiles?.[0]?.display_name || "Community member"}</strong><p>{feedPost.body}</p></Link> : !hasFeedAccess ? <Link href="/membership" className="hc-home3-post">HoopFeed is available with Pro or Premium. View membership →</Link> : null}
        </section>
        {teams.length > 0 ? <section className="hc-home3-section"><h2>YOUR TEAM</h2><Link href={(basketballSide === "womens" ? "/womens/" : "/teams/") + teams[0].id} className="hc-home3-team"><TeamLogo name={teams[0].name} size={34}/><strong>{teams[0].name}</strong><span>Team page →</span></Link></section> : <Link href="/teams" className="hc-home3-team">Find your team →</Link>}
        <footer className="hc-home3-footer">Every league. Every level. Real reviews, one community.</footer>
      </div>
    </main>
  );
}
