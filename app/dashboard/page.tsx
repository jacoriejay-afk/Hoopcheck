"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCachedSession, supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import SearchBar from "../../components/SearchBar";
import { useLanguage } from "../../components/LanguageProvider";
import { useFanBasketballSide } from "../../components/FanBasketballSideSwitch";
import { CategoryIconTile, HoopIcon } from "../../components/HoopCheckUI";

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
type FeedPost = { id:string; body:string; created_at:string; expires_at:string; author_id:string; profiles?:{display_name:string|null}|null };

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
  const [liveCounts,setLiveCounts] = useState({live:0,upcoming:0});
  const [hasFeedAccess,setHasFeedAccess] = useState(false);
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadHome() {
      const {data:{session}} = await withTimeout<any>(getCachedSession(),7000,{data:{session:null},error:new Error("session-timeout")});
      const user = session?.user;
      if (!user) { if(mounted) router.replace("/login?next=/dashboard"); return; }
      if (!mounted) return;
      setEmail(user.email||"");

      const [{data:p},{data:subscription},{data:follows}] = await Promise.all([
        supabase.from("profiles").select("display_name,first_name,last_name,bio,position,current_team,nationality,hometown,avatar_url,player_verified,account_type").eq("id",user.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,access_status").eq("user_id",user.id).maybeSingle(),
        supabase.from("follow_relationships").select("target_id").eq("follower_id",user.id).eq("target_type","team").order("created_at",{ascending:false}).limit(100)
      ]);
      if (!mounted) return;
      setProfile(p as Profile|null);
      const activeMember = ["pro","premium"].includes(subscription?.plan||"") && ["active","trialing"].includes(subscription?.status||"") && (!subscription?.access_status || ["active","trialing","pro","premium"].includes(subscription.access_status));
      const followedIds = (follows||[]).map((row:any)=>row.target_id).filter(Boolean);

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
        const {data:games} = await supabase.from("fan_live_games").select("status,scheduled_at").in("status",["live","scheduled"]).order("scheduled_at",{ascending:true}).limit(200);
        const now = Date.now();
        if (mounted) setLiveCounts({live:(games||[]).filter((g:any)=>g.status==="live").length,upcoming:(games||[]).filter((g:any)=>g.status==="scheduled" && (!g.scheduled_at || new Date(g.scheduled_at).getTime()>=now)).length});
      }
      if (mounted) setLoading(false);
    }
    loadHome().catch((error)=>{console.error("Unable to load HoopCheck home:",error);if(mounted)setLoading(false);});
    return ()=>{mounted=false;};
  },[router,basketballSide]);

  const displayName = profile?.display_name || [profile?.first_name,profile?.last_name].filter(Boolean).join(" ") || email.split("@")[0] || "Player";
  const completion = useMemo(()=>{
    if(!profile || profile.account_type==="fan") return 100;
    const fields=[profile.display_name,profile.bio,profile.position,profile.current_team,profile.nationality,profile.hometown,profile.avatar_url];
    return Math.round(fields.filter(value=>Boolean(String(value||"").trim())).length/fields.length*100);
  },[profile]);

  if(loading) return <main className="page-shell dashboard-page"><div className="page-container"><HoopLoading label={t("loadingDashboard")}/></div></main>;

  if(profile?.account_type==="fan") return (
    <main className="page-shell hc-ia-home"><div className="page-container">
      <header className="hc-ia-welcome"><p className="eyebrow">FAN HQ</p><h1>YOUR BASKETBALL COMMUNITY<span>.</span></h1><p className="muted">Your teams, fan conversations, and live game rooms in one place.</p><div className="hc-ia-identity"><span className="hc-ia-avatar">{displayName.charAt(0).toUpperCase()}</span><span><small>SIGNED IN AS</small><strong>{displayName}</strong></span></div></header>
      <section className="hc-ia-section"><h2>YOUR FAN SIDE</h2><div className="hc-ia-fan-grid">
        <Link href="/team-hub" className="hc-ia-door"><CategoryIconTile category="teams" size="sm"/><span><strong>TEAM HUB</strong><small>Followed teams and updates</small></span><HoopIcon name="chevron-right" size={18}/></Link>
        <Link href="/fan-feed" className="hc-ia-door"><CategoryIconTile category="reviews" size="sm"/><span><strong>FAN HOOPFEED</strong><small>Posts from teams you follow</small></span><HoopIcon name="chevron-right" size={18}/></Link>
        <Link href="/fans" className="hc-ia-door"><CategoryIconTile category="players" size="sm"/><span><strong>FIND FAN</strong><small>Discover and connect with fans</small></span><HoopIcon name="chevron-right" size={18}/></Link>
        <Link href="/live-games" className="hc-ia-door"><CategoryIconTile category="leagues" size="sm"/><span><strong>LIVE GAMES</strong><small>{liveCounts.live} live · {liveCounts.upcoming} upcoming</small></span><HoopIcon name="chevron-right" size={18}/></Link>
      </div></section>
      <Link href="/account" className="hc-ia-account-link">Account, membership and settings <HoopIcon name="arrow-right" size={16}/></Link>
    </div></main>
  );

  return (
    <main className="page-shell hc-ia-home">
      <div className="page-container">
        <SearchBar className="hc-ia-search" name="q" placeholder={t("searchPeoplePlaceholder")} ariaLabel={t("searchPeoplePlaceholder")}/>
        <header className="hc-ia-welcome">
          <p className="eyebrow">YOUR DAILY FRONT DOOR</p>
          <h1>KNOW WHO YOU’RE SIGNING WITH<span>.</span></h1>
          <p className="muted">Real player experiences. Make your next move with confidence.</p>
          <div className="hc-ia-identity"><span className="hc-ia-avatar">{displayName.charAt(0).toUpperCase()}</span><span><small>SIGNED IN AS</small><strong>{displayName}</strong></span></div>
        </header>

        {completion < 100 && <Link href="/account#edit-profile" className="hc-ia-completion"><span><strong>COMPLETE YOUR PROFILE</strong><small>{completion}% complete · Add your basketball background so players and organisations can recognise your experience.</small></span><span>Continue <HoopIcon name="arrow-right" size={16}/></span></Link>}

        <Link href="/live-games" className="hc-ia-live-strip"><span className="hc-ia-live-dot"/><span><strong>LIVE GAMES</strong><small>{profile?.account_type === "fan" ? `${liveCounts.live} live now · ${liveCounts.upcoming} upcoming` : "See live and upcoming games"}</small></span><span>Open hub <HoopIcon name="arrow-right" size={16}/></span></Link>

        <section className="hc-ia-section">
          <div className="hc-ia-section-heading"><div><p className="eyebrow">YOUR SHORTCUTS</p><h2>QUICK ACCESS</h2></div><Link href="/directory">Explore all <HoopIcon name="arrow-right" size={15}/></Link></div>
          <div className="hc-ia-door-grid">
            <Link href="/teams" className="hc-ia-door"><CategoryIconTile category="teams" size="sm"/><span><strong>MEN’S TEAMS</strong><small>Research teams before you sign</small></span><HoopIcon name="chevron-right" size={18}/></Link>
            <Link href="/womens" className="hc-ia-door"><CategoryIconTile category="womens" size="sm"/><span><strong>WOMEN’S TEAMS</strong><small>Explore women’s basketball</small></span><HoopIcon name="chevron-right" size={18}/></Link>
            <Link href="/coaches" className="hc-ia-door"><CategoryIconTile category="coaches" size="sm"/><span><strong>COACHES</strong><small>Check coaching reputations</small></span><HoopIcon name="chevron-right" size={18}/></Link>
            <Link href="/leagues" className="hc-ia-door"><CategoryIconTile category="leagues" size="sm"/><span><strong>LEAGUES</strong><small>Compare competitions</small></span><HoopIcon name="chevron-right" size={18}/></Link>
            <Link href="/players" className="hc-ia-door"><CategoryIconTile category="players" size="sm"/><span><strong>PLAYERS</strong><small>Discover basketball players</small></span><HoopIcon name="chevron-right" size={18}/></Link>
          </div>
        </section>

        <section className="hc-ia-section">
          <div className="hc-ia-section-heading"><div><p className="eyebrow">YOUR NETWORK</p><h2>TEAMS YOU FOLLOW</h2></div><Link href="/teams">Find teams <HoopIcon name="arrow-right" size={15}/></Link></div>
          {teams.length ? <div className="hc-ia-follow-list">{teams.slice(0,4).map(team=><Link key={team.id} href={basketballSide==="womens"?"/womens/"+team.id:"/teams/"+team.id}><span><strong>{team.name}</strong><small>{[team.country,team.league_name].filter(Boolean).join(" · ")}</small></span><HoopIcon name="chevron-right" size={17}/></Link>)}</div> : <p className="hc-ia-empty">Follow teams to see their updates here. <Link href="/teams">Browse teams</Link></p>}
        </section>

        {reviews.length>0 && <section className="hc-ia-section"><div className="hc-ia-section-heading"><div><p className="eyebrow">PLAYER EXPERIENCES</p><h2>RECENT REVIEWS ON YOUR TEAMS</h2></div></div><div className="hc-ia-follow-list">{reviews.slice(0,3).map(review=><Link key={review.id} href={(basketballSide==="womens"?"/womens/":"/teams/")+review.team_id}><span><strong>{review.title||"Player review"}</strong><small>{review.body.slice(0,110)}{review.body.length>110?"…":""} · {review.overall_rating}/5</small></span><HoopIcon name="chevron-right" size={17}/></Link>)}</div></section>}

        <section className="hc-ia-section hc-ia-feed-teaser"><div className="hc-ia-section-heading"><div><p className="eyebrow">PLAYER NETWORK</p><h2>HOOPFEED</h2></div><Link href="/feed">Open feed <HoopIcon name="arrow-right" size={15}/></Link></div>
          {hasFeedAccess && feedPost ? <Link href="/feed" className="hc-ia-feed-card"><strong>{feedPost.profiles?.display_name||"A player you follow"}</strong><p>{feedPost.body.slice(0,180)}{feedPost.body.length>180?"…":""}</p><small>Latest post · Posts expire after 24 hours</small></Link> : <Link href="/feed" className="hc-ia-feed-card"><strong>Open HoopFeed</strong><p>Updates from players you follow and your accepted connections.</p><small>Followers-only · 24-hour posts</small></Link>}
        </section>
        <Link href="/account" className="hc-ia-account-link">Account, membership, reviews and settings <HoopIcon name="arrow-right" size={16}/></Link>
      </div>
    </main>
  );
}
