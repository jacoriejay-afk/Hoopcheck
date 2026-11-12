"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
import {useLanguage} from "../../../components/LanguageProvider";
import Surface from "../../../components/Surface";
import HoopLoading from "../../../components/HoopLoading";
import ClaimedTeamLogoEditor from "../../../components/ClaimedTeamLogoEditor";
import TeamProfileHero from "../../../components/TeamProfileHero";
import "../../hoopcheck-brand-team.css";
import ReviewMembershipGate from "../../../components/ReviewMembershipGate";
import TeamFanGroupEntry from "../../../components/TeamFanGroupEntry";
import FanBasketballSideSwitch from "../../../components/FanBasketballSideSwitch";
import TeamPlayersHistory from "../../../components/TeamPlayersHistory";
import FanTeamPosts from "../../../components/FanTeamPosts";

export default function WomensTeam(){
 const {formatDate,formatNumber,t}=useLanguage();
 const [activeSection,setActiveSection]=useState<"overview"|"roster"|"coaches"|"reviews"|"fan-group">("overview");
 useEffect(()=>{
   const syncSection=()=>{
     const hash=window.location.hash;
     if(["#reviews","#womens-team-reviews-panel"].includes(hash))setActiveSection("reviews");
     else if(["#fan-hq","#fan-group","#womens-team-fan-group-panel"].includes(hash))setActiveSection("fan-group");
     else if(["#roster","#players","#womens-team-roster-panel"].includes(hash))setActiveSection("roster");
     else if(["#coaches","#womens-team-coaches-panel"].includes(hash))setActiveSection("coaches");
     else if(["#overview","#womens-team-overview-panel"].includes(hash))setActiveSection("overview");
   };
   syncSection();
   window.addEventListener("hashchange",syncSection);
   return()=>window.removeEventListener("hashchange",syncSection);
 },[]);
 const [coaches,setCoaches]=useState<Array<{id:string;name:string;city:string|null;country:string|null}>>([]);
 const [leagueSeason,setLeagueSeason]=useState<string|null>(null);
 const {id}=useParams<{id:string}>(); const [team,setTeam]=useState<any>(null); const [reviews,setReviews]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [canViewReviews,setCanViewReviews]=useState(false); const [canSeeRatings,setCanSeeRatings]=useState(false); const [canReview,setCanReview]=useState(false); const [accountType,setAccountType]=useState(""); const [ratingAverage,setRatingAverage]=useState<number|null>(null); const [ratingCount,setRatingCount]=useState(0); const [reviewTier,setReviewTier]=useState<"free"|"pro"|"premium"|"player"|"member">("free"); const [teamFollowerCount,setTeamFollowerCount]=useState(0); const [trustScoreData,setTrustScoreData]=useState<any>(null);
 useEffect(() => {
   let active = true;
   (async () => {
     const [{ data: teamData, error: teamError }, { count: followerCount }] = await Promise.all([
       supabase.from("womens_teams").select("id,name,country,city,league_id,league_name,logo_url,logo_bg").eq("id", id).maybeSingle(),
       supabase.from("follow_relationships").select("id", { count: "exact", head: true }).eq("target_type", "team").eq("target_id", id),
     ]);
     if (teamError) console.error("Unable to load women’s team profile:", teamError);
     if (!active) return;
     setTeam(teamData || null);
     setLeagueSeason(null);
     if(teamData?.league_id){const {data:leagueRow}=await supabase.from("leagues").select("season").eq("id",teamData.league_id).maybeSingle();if(active)setLeagueSeason(typeof leagueRow?.season==="string"&&leagueRow.season.trim()?leagueRow.season.trim():null);}
     if(teamData){const {data:coachRows,error:coachError}=await supabase.from("coaches").select("id,name,city,country").eq("current_team_id",teamData.id).eq("active",true).order("name");if(active){setCoaches(coachError?[]:(coachRows||[]));}}
     setTeamFollowerCount(followerCount || 0);
     const { data: { session } } = await supabase.auth.getSession();
     if (session?.user) {
       const response = await fetch(`/api/review-access?entityType=womens-team&entityId=${encodeURIComponent(id)}`, {
         headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
       });
       const payload = response.ok ? await response.json() : null;
       const tier = (payload?.tier || "free") as typeof reviewTier;
       if (!active) return;
       setReviewTier(tier);
       setAccountType(payload?.accountType || "");
       const fullRead = payload?.canReadFull === true;
       setCanSeeRatings(tier !== "free");
       setCanViewReviews(fullRead);
       setCanReview(payload?.canWrite === true);
       if (fullRead) {
         const trustResponse = await fetch(`/api/trust-score?entityType=womens-team&entityId=${encodeURIComponent(id)}`, {
           headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
         });
         const trustPayload = trustResponse.ok ? await trustResponse.json() : null;
         if (active) setTrustScoreData(trustPayload);
       } else {
         setTrustScoreData(null);
       }
       const summary = payload?.summary;
       if (summary) {
         setRatingCount(Number(summary.review_count || 0));
         setRatingAverage(summary.overall_rating == null ? null : Number(summary.overall_rating));
       }
       setReviews(fullRead && Array.isArray(payload?.reviews) ? payload.reviews : []);
     } else {
       setCanSeeRatings(false); setCanViewReviews(false); setCanReview(false); setReviewTier("free"); setAccountType(""); setTrustScoreData(null); setReviews([]);
     }
     if (active) setLoading(false);
   })().catch(error => { console.error("Unable to load women’s team review access:", error); if (active) setLoading(false); });
   return () => { active = false; };
 }, [id]);
 if(loading)return <main className="page-shell hc-womens-profile-page"><div className="page-container"><HoopLoading label={t("loadingWomensTeam")} /></div></main>;
 if(!team)return <main className="page-shell hc-womens-profile-page"><div className="page-container"><Surface as="section" className="hero-card"><h1>{t("womenTeamNotFound")}</h1><Link href="/womens" className="btn">{t("backToWomensBasketball")}</Link></Surface></div></main>;
 const average=ratingAverage;
 return <main className="page-shell hc-womens-profile-page"><div className="page-container">
 <FanBasketballSideSwitch lockedHint />
 <TeamProfileHero
   className="hc-womens-branded-hero"
   gender="womens"
   seasonLabel={leagueSeason}
   teamId={team.id}
   name={team.name}
   country={team.country || t("international")}
   city={team.city}
   leagueName={team.league_name || t("professional")}
   logoUrl={team.logo_url}
   logoBg={team.logo_bg}
   reviewCount={ratingCount}
   followerCount={teamFollowerCount}
   trustScore={trustScoreData ? { score: trustScoreData.score ?? null, explanation: trustScoreData.explanation || "Trust Score", reviewCount: trustScoreData.reviewCount ?? ratingCount, verifiedReviewCount: trustScoreData.verifiedReviewCount ?? 0 } : null}
   onFollowerCountChange={setTeamFollowerCount}
   onOpenFanGroup={()=>setActiveSection("fan-group")}
 />
 <nav className="hc-team-profile-nav" aria-label="Team profile sections" style={{position:"sticky",top:"var(--hc-header-height, 72px)",zIndex:20,overflowX:"auto",borderRadius:16,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",background:"var(--surface,rgba(24,27,36,.92))"}}>
   <div role="tablist" aria-label="Team profile tabs" onKeyDown={(event)=>{if(event.key!=="ArrowRight"&&event.key!=="ArrowLeft"&&event.key!=="Home"&&event.key!=="End")return;event.preventDefault();const tabs=["overview","roster","coaches","reviews","fan-group"] as const;const current=tabs.indexOf(activeSection);const next=event.key==="Home"?tabs[0]:event.key==="End"?tabs[tabs.length-1]:tabs[(current+(event.key==="ArrowRight"?1:tabs.length-1))%tabs.length];setActiveSection(next);document.getElementById(`womens-team-${next}-tab`)?.focus();}}>
     {(["overview","roster","coaches","reviews","fan-group"] as const).map(tab=><button key={tab} id={`womens-team-${tab}-tab`} type="button" role="tab" aria-selected={activeSection===tab} aria-controls={`womens-team-${tab}-panel`} tabIndex={activeSection===tab?0:-1} onClick={()=>setActiveSection(tab)}>{tab==="fan-group"?"Fan Group":tab==="overview"?"Overview":tab==="roster"?"Roster":tab==="coaches"?"Coaches":"Reviews"}</button>)}
   </div>
 </nav>
 <section id="womens-team-roster-panel" role="tabpanel" aria-labelledby="womens-team-roster-tab" hidden={activeSection!=="roster"}>
   <TeamPlayersHistory teamId={team.id} teamTable="womens_teams" />
 </section>
 <section className="card" id="womens-team-coaches-panel" role="tabpanel" aria-labelledby="womens-team-coaches-tab" hidden={activeSection!=="coaches"}>
   <p className="eyebrow">TEAM STAFF</p><h2>Coaches</h2>
   {coaches.length ? <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
     {coaches.map(coach=><Link key={coach.id} href={`/coaches/${coach.id}`} className="card" style={{display:"flex",alignItems:"center",gap:12,textDecoration:"none"}}>
       <span aria-hidden="true" style={{width:44,height:44,borderRadius:"50%",display:"grid",placeItems:"center",background:"var(--surface-muted,rgba(128,128,128,.16))",fontWeight:800}}>{coach.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()}</span>
       <span><strong>{coach.name}</strong><small style={{display:"block"}}>{[coach.city,coach.country].filter(Boolean).join(", ")}</small></span>
     </Link>)}
   </div> : <p className="muted">No coaches are listed for this club yet.</p>}
 </section>
 <div id="womens-team-fan-group-panel" role="tabpanel" aria-labelledby="womens-team-fan-group-tab" hidden={activeSection!=="fan-group"}><div id="fan-hq"><TeamFanGroupEntry teamId={team.id} /></div></div>
 {canReview && <div className="entity-actions"><Link href={"/womens/" + team.id + "/review"} className="btn">Write a Review</Link></div>}
 <ClaimedTeamLogoEditor teamId={team.id} teamName={team.name} teamTable="womens_teams" onSaved={(logoUrl, logoBg) => setTeam((current:any) => current ? { ...current, logo_url: logoUrl, logo_bg: logoBg } : current)} />
 <section className="grid compact-grid" id="womens-team-overview-panel" role="tabpanel" aria-labelledby="womens-team-overview-tab" hidden={activeSection!=="overview"}>
    {canSeeRatings ? <Surface className="card"><span className="card-kicker">{t("rating")}</span><h2>{average===null?"—":average.toFixed(1)+"/5"}</h2><p className="muted">{formatNumber(ratingCount)+" "+(ratingCount===1?t("publishedReview"):t("publishedReviews"))}</p></Surface> : null}
    <Surface className="card"><span className="card-kicker">{t("league")}</span><h2>{team.league_name||t("professional")}</h2><p className="muted">{team.country||t("international")}</p></Surface>
  </section>
  <Surface as="section" id="womens-team-reviews-panel" className="dashboard-card compact-section" role="tabpanel" aria-labelledby="womens-team-reviews-tab" hidden={activeSection!=="reviews"}>
    {!canViewReviews ? (
      <ReviewMembershipGate
        title="Full player reviews require an eligible membership"
        description="Sign in with an eligible active membership to view full reviews and ratings."
        actionLabel="Upgrade"
        accountType={accountType}
        tier={reviewTier}
      />
    ) : (
      <>
        <p className="eyebrow">{t("playerExperiences")}</p>
        <h2>{t("ratingsReviews")}</h2>
        {reviews.map(r=><article className="compact-review" key={r.id}><div className="review-line"><strong>{r.title||t("playerExperience")}</strong><strong>{Number(r.overall_rating).toFixed(1)}/5</strong></div><p>{r.body}</p><small className="muted">{formatDate(r.created_at)}</small></article>)}
        {!reviews.length&&<p className="muted">{t("noPublishedReviewsYet")}</p>}
      </>
    )}
  </Surface>
  <FanTeamPosts teamId={team.id} />
  <div className="bottom-back"><button type="button" className="btn dark" onClick={()=>window.history.back()}>← {t("back")}</button></div></div></main>;
}