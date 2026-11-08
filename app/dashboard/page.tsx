"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCachedSession, supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import HomePulse from "../../components/HomePulse";
import SearchBar from "../../components/SearchBar";
import { useLanguage } from "../../components/LanguageProvider";
import { hasActiveMembershipAtLeast } from "../../lib/membership-tier";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import { CategoryIconTile, HoopIcon } from "../../components/HoopCheckUI";
import { calculateProfileCompletion } from "../../lib/profile-completion";

type Profile = {
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

const withTimeout = <T,>(promise: PromiseLike<T>, ms = 8000, fallback?: T) =>
  Promise.race([Promise.resolve(promise), new Promise<T>((resolve) => setTimeout(() => resolve(fallback as T), ms))]);

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
        if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
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
        supabase.from("profiles").select("display_name,first_name,last_name,bio,position,current_team,nationality,hometown,avatar_url,interests,favorite_leagues,player_verified,account_type").eq("id",user.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,access_status").eq("user_id",user.id).maybeSingle(),
        supabase.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","team").order("created_at",{ascending:false}).limit(100)
      ]);
      if (!mounted) return;
      // Optional dashboard data must never turn a valid login into an unavailable dashboard.
      const p = profileResult.status === "fulfilled" ? profileResult.value.data : null;
      const subscription = subscriptionResult.status === "fulfilled" ? subscriptionResult.value.data : null;
      const follows = followsResult.status === "fulfilled" ? followsResult.value.data : null;
      if (profileResult.status === "rejected") console.error("Dashboard profile request failed:", profileResult.reason);
      if (subscriptionResult.status === "rejected") console.error("Dashboard subscription request failed:", subscriptionResult.reason);
      if (followsResult.status === "rejected") console.error("Dashboard follows request failed:", followsResult.reason);
      setProfile(p as Profile|null);
      const activeMember = hasActiveMembershipAtLeast(subscription);
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

      const canUsePlayerFeed = p?.account_type === "player" && activeMember;
      setHasFeedAccess(canUsePlayerFeed);
      if (canUsePlayerFeed) {
        const [{data:followedPlayers},{data:connections},{data:posts}] = await Promise.all([
          supabase.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","player").limit(100),
          supabase.from("player_contact_requests").select("requester_id,player_id").or(`requester_id.eq.${user.id},player_id.eq.${user.id}`).eq("status","accepted").limit(100),
          supabase.from("feed_posts").select("id,body,created_at,expires_at,author_id,profiles(display_name)").eq("status","approved").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(30)
        ]);
        const allowedAuthors = new Set([user.id,...(followedPlayers||[]).map((x:any)=>x.target_id),...(connections||[]).map((x:any)=>x.requester_id===user.id?x.player_id:x.requester_id)]);
        const latest = (posts||[]).find((post:any)=>allowedAuthors.has(post.author_id));
        if (mounted && latest) setFeedPost(latest as FeedPost);
      }

      if (p?.account_type === "fan" && activeMember) {
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

  if(loadError)return <main className="page-shell dashboard-page"><div className="page-container"><div role="alert" className="hc-smooth-inbox-error"><strong>Dashboard unavailable.</strong> {authErrorDetail || "Please try again."}  <button type="button" onClick={()=>setReloadKey(v=>v+1)}>Retry dashboard</button></div></div></main>;

  if(profile?.account_type==="fan") return (
    <main className="page-shell hc-ia-home hc-dashboard-compact"><div className="page-container">
      <header className="hc-ia-welcome"><p className="eyebrow">{t("home.fanEyebrow")}</p><h1>{t("home.fanTitle")}<span>.</span></h1><p className="muted">{t("home.fanDescription")}</p><div className="hc-ia-identity"><span className="hc-ia-avatar">{displayName.charAt(0).toUpperCase()}</span><span><small>{t("home.signedIn")}</small><strong>{displayName}</strong></span></div></header>
      <HomePulse live={liveCounts.live} upcoming={liveCounts.upcoming} followedClubs={teams.length} fan/>
      <section className="hc-ia-section"><h2>{t("home.fanSide")}</h2><div className="hc-ia-fan-grid">
        <Link href="/team-hub" className="hc-ia-door"><CategoryIconTile category="teams" size="sm"/><span><strong>{t("home.teamHub")}</strong><small>{t("home.teamHubDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
        <Link href="/fan-feed" className="hc-ia-door"><CategoryIconTile category="reviews" size="sm"/><span><strong>{t("home.fanFeed")}</strong><small>{t("home.fanFeedDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
        <Link href="/fans" className="hc-ia-door"><CategoryIconTile category="reviews" icon="users" size="sm"/><span><strong>{t("home.findFan")}</strong><small>{t("home.findFanDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
        <Link href="/fan-live" className="hc-ia-door"><CategoryIconTile category="leagues" size="sm"/><span><strong>{t("home.liveGames")}</strong><small>{liveCounts.live===null?"Games hub":`${liveCounts.live} live · ${liveCounts.upcoming ?? "—"} upcoming`}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
      </div></section>
      <Link href="/account" className="hc-ia-account-link">{t("home.accountSettings")} <HoopIcon name="arrow-right" size={16}/></Link>
    </div></main>
  );

  return (
    <main className="page-shell hc-ia-home">
      <div className="page-container">
        <SearchBar className="hc-ia-search" name="q" placeholder={t("searchPeoplePlaceholder")} ariaLabel={t("searchPeoplePlaceholder")}/>
        <header className="hc-ia-welcome">
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1>{t("home.headline")}<span>.</span></h1>
          <p className="muted">{t("home.description")}</p>
          <div className="hc-ia-identity"><span className="hc-ia-avatar">{displayName.charAt(0).toUpperCase()}</span><span><small>SIGNED IN AS</small><strong>{displayName}</strong></span></div>
        </header>

        {completion < 100 && <Link href="/account#edit-profile" className="hc-ia-completion"><span><strong>{t("home.completeProfile")}</strong><small>{t("home.profileCompletion").replace("{percent}", String(completion))}</small></span><span>{t("home.continue")} <HoopIcon name="arrow-right" size={16}/></span></Link>}

        <HomePulse live={null} upcoming={null} followedClubs={teams.length} recentReviews={reviews.length}/>
        <Link href="/live-games" className="hc-ia-live-strip"><span className={liveCounts.live!==null && liveCounts.live>0 ? "hc-ia-live-dot" : "hc-ia-live-dot hc-ia-live-dot--inactive"} aria-hidden="true"/><span><strong>{t("home.liveGames")}</strong><small>{t("home.liveDescription")}</small></span><span>{t("home.openHub")} <HoopIcon name="arrow-right" size={16}/></span></Link>

        {profile?.account_type==="player" && <Link href="/pre-sign" className="hc-smooth-presign-dashboard-link hc-smooth-card"><span><small>PLAYER INTELLIGENCE</small><strong>Pre-Sign Check</strong><span>Six checks to research a club before you commit to a contract.</span></span><HoopIcon name="arrow-right" size={18}/></Link>}

        <section className="hc-ia-section">
          <div className="hc-ia-section-heading"><div><p className="eyebrow">{t("home.shortcuts")}</p><h2>{t("home.quickAccess")}</h2></div><Link href="/directory">{t("home.exploreAll")} <HoopIcon name="arrow-right" size={15}/></Link></div>
          <div className="hc-ia-door-grid">
            <Link href="/teams" className="hc-ia-door"><CategoryIconTile category="teams" size="sm"/><span><strong>{t("home.mensTeams")}</strong><small>{t("home.mensDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
            <Link href="/womens" className="hc-ia-door"><CategoryIconTile category="womens" size="sm"/><span><strong>{t("home.womensTeams")}</strong><small>{t("home.womensDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
            <Link href="/coaches" className="hc-ia-door"><CategoryIconTile category="coaches" size="sm"/><span><strong>{t("home.coaches")}</strong><small>{t("home.coachesDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
            <Link href="/leagues" className="hc-ia-door"><CategoryIconTile category="leagues" size="sm"/><span><strong>{t("home.leagues")}</strong><small>{t("home.leaguesDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
            <Link href="/players" className="hc-ia-door"><CategoryIconTile category="players" size="sm"/><span><strong>{t("home.players")}</strong><small>{t("home.playersDescription")}</small></span><HoopIcon name="chevron-right" size={18}/></Link>
          </div>
        </section>

        <section className="hc-ia-section">
          <div className="hc-ia-section-heading"><div><p className="eyebrow">{t("home.network")}</p><h2>{t("home.teamsFollow")}</h2></div><Link href="/teams">{t("home.findTeams")} <HoopIcon name="arrow-right" size={15}/></Link></div>
          {teams.length ? <div className="hc-ia-follow-list">{teams.slice(0,4).map(team=><Link key={team.id} href={basketballSide==="womens"?"/womens/"+team.id:"/teams/"+team.id}><span><strong>{team.name}</strong><small>{[team.country,team.league_name].filter(Boolean).join(" · ")}</small></span><HoopIcon name="chevron-right" size={17}/></Link>)}</div> : <p className="hc-ia-empty">{t("home.emptyTeams")} <Link href="/teams">{t("home.browseTeams")}</Link></p>}
        </section>

        {reviews.length>0 && <section className="hc-ia-section"><div className="hc-ia-section-heading"><div><p className="eyebrow">{t("home.experiences")}</p><h2>{t("home.recentReviews")}</h2></div></div><div className="hc-ia-follow-list">{reviews.slice(0,3).map(review=><Link key={review.id} href={(basketballSide==="womens"?"/womens/":"/teams/")+review.team_id}><span><strong>{review.title||t("home.playerReview")}</strong><small>{review.body.slice(0,110)}{review.body.length>110?"…":""} · {review.overall_rating}/5</small></span><HoopIcon name="chevron-right" size={17}/></Link>)}</div></section>}

        <section className="hc-ia-section hc-ia-feed-teaser"><div className="hc-ia-section-heading"><div><p className="eyebrow">{t("home.playerNetwork")}</p><h2>{t("home.hoopFeed")}</h2></div><Link href="/feed">{t("home.openFeed")} <HoopIcon name="arrow-right" size={15}/></Link></div>
          {hasFeedAccess && feedPost ? <Link href="/feed" className="hc-ia-feed-card"><strong>{feedPost.profiles?.[0]?.display_name||t("home.playerFollow")}</strong><p>{feedPost.body.slice(0,180)}{feedPost.body.length>180?"…":""}</p><small>{t("home.latestPost")}</small></Link> : <Link href="/feed" className="hc-ia-feed-card"><strong>{t("home.openHoopFeed")}</strong><p>{t("home.feedDescription")}</p><small>{t("home.followersOnly")}</small></Link>}
        </section>
        <Link href="/account" className="hc-ia-account-link">{t("home.accountReviewsSettings")} <HoopIcon name="arrow-right" size={16}/></Link>
      </div>
    </main>
  );
}
