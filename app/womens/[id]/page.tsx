"use client";
import {useEffect,useState} from "react";
import { countryFlag } from "../../../lib/countryFlag";
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
import FanTeamPosts from "../../../components/FanTeamPosts";

export default function WomensTeam(){
 const {formatDate,formatNumber,t}=useLanguage();
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
 <TeamProfileHero
   className="hc-womens-branded-hero"
   teamId={team.id}
   name={team.name}
   country={`${countryFlag(team.country) ? countryFlag(team.country) + " " : ""}${team.country || t("international")}`}
   city={team.city}
   leagueName={team.league_name || t("professional")}
   logoUrl={team.logo_url}
   logoBg={team.logo_bg}
   reviewCount={ratingCount}
   followerCount={teamFollowerCount}
   trustScore={trustScoreData ? { score: trustScoreData.score ?? null, explanation: trustScoreData.explanation || "Trust Score", reviewCount: trustScoreData.reviewCount ?? ratingCount, verifiedReviewCount: trustScoreData.verifiedReviewCount ?? 0 } : null}
   onFollowerCountChange={setTeamFollowerCount}
 />
 <nav className="hc-team-profile-nav" aria-label="Team profile sections">
   <a href="#overview" aria-current="page">Overview</a>
   <a href="#reviews">Reviews</a>
 </nav>
 <TeamFanGroupEntry teamId={team.id} />
 {canReview && <div className="entity-actions"><Link href={"/womens/" + team.id + "/review"} className="btn">Write a Review</Link></div>}
 <ClaimedTeamLogoEditor teamId={team.id} teamName={team.name} teamTable="womens_teams" onSaved={(logoUrl, logoBg) => setTeam((current:any) => current ? { ...current, logo_url: logoUrl, logo_bg: logoBg } : current)} />
 <section className="grid compact-grid">
    {canSeeRatings ? <Surface className="card"><span className="card-kicker">{t("rating")}</span><h2>{average===null?"—":average.toFixed(1)+"/5"}</h2><p className="muted">{formatNumber(ratingCount)+" "+(ratingCount===1?t("publishedReview"):t("publishedReviews"))}</p></Surface> : null}
    <Surface className="card"><span className="card-kicker">{t("league")}</span><h2>{team.league_name||t("professional")}</h2><p className="muted">{team.country||t("international")}</p></Surface>
  </section>
  <Surface as="section" id="reviews" className="dashboard-card compact-section">
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