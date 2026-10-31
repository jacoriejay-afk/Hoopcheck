"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
import {useLanguage} from "../../../components/LanguageProvider";
import FollowButton from "../../../components/FollowButton";
import Surface from "../../../components/Surface";
import HoopLoading from "../../../components/HoopLoading";
import TeamLogo from "../../../components/TeamLogo";
import ClaimedTeamLogoEditor from "../../../components/ClaimedTeamLogoEditor";
import TeamPlayersHistory from "../../../components/TeamPlayersHistory";

export default function WomensTeam(){
 const {formatDate,formatNumber,t}=useLanguage();
 const {id}=useParams<{id:string}>(); const [team,setTeam]=useState<any>(null); const [reviews,setReviews]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [canViewReviews,setCanViewReviews]=useState(false); const [canSeeRatings,setCanSeeRatings]=useState(false); const [canReview,setCanReview]=useState(false); const [ratingAverage,setRatingAverage]=useState<number|null>(null); const [ratingCount,setRatingCount]=useState(0); const [reviewTier,setReviewTier]=useState<"free"|"pro"|"premium"|"player"|"member">("free");
 useEffect(() => {
   let active = true;
   (async () => {
     const { data: teamData, error: teamError } = await supabase.from("womens_teams")
       .select("id,name,country,city,league_id,league_name,logo_url,logo_bg").eq("id", id).maybeSingle();
     if (teamError) console.error("Unable to load women’s team profile:", teamError);
     if (!active) return;
     setTeam(teamData || null);
     const { data: { session } } = await supabase.auth.getSession();
     if (session?.user) {
       const { data: profile } = await supabase.from("profiles")
         .select("account_type,basketball_type,player_verified,selected_womens_team_id").eq("id", session.user.id).maybeSingle();
       const response = await fetch(`/api/review-access?entityType=womens-team&entityId=${encodeURIComponent(id)}`, {
         headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store",
       });
       const payload = response.ok ? await response.json() : null;
       const tier = profile?.account_type === "player" ? "player" : ((payload?.tier || "free") as typeof reviewTier);
       if (!active) return;
       setReviewTier(tier);
       const fullRead = ["premium", "player", "member"].includes(tier);
       setCanSeeRatings(tier !== "free");
       setCanViewReviews(fullRead);
       setCanReview(profile?.account_type === "player" && profile?.basketball_type === "womens" &&
         Boolean(profile?.player_verified) && profile?.selected_womens_team_id === id);
       const summary = payload?.summary;
       if (summary) {
         setRatingCount(Number(summary.review_count || 0));
         setRatingAverage(summary.overall_rating == null ? null : Number(summary.overall_rating));
       }
       setReviews(fullRead && Array.isArray(payload?.reviews) ? payload.reviews : []);
     } else {
       setCanSeeRatings(false); setCanViewReviews(false); setCanReview(false); setReviewTier("free"); setReviews([]);
     }
     if (active) setLoading(false);
   })().catch(error => { console.error("Unable to load women’s team review access:", error); if (active) setLoading(false); });
   return () => { active = false; };
 }, [id]);
 if(loading)return <main className="page-shell hc-womens-profile-page"><div className="page-container"><HoopLoading label={t("loadingWomensTeam")} /></div></main>;
 if(!team)return <main className="page-shell hc-womens-profile-page"><div className="page-container"><Surface as="section" className="hero-card"><h1>{t("womenTeamNotFound")}</h1><Link href="/womens" className="btn">{t("backToWomensBasketball")}</Link></Surface></div></main>;
 const average=ratingAverage;
 return <main className="page-shell hc-womens-profile-page"><div className="page-container">
 <Surface as="section" className="hero-card"><p className="eyebrow">{t("womensTeamProfile")}</p><div className="hc-team-profile-heading hc-team-profile-heading--club"><TeamLogo name={team.name} logoUrl={team.logo_url} logoBg={team.logo_bg} size={96} className="hc-team-profile-logo"/><div className="hc-team-profile-heading__copy"><p className="hc-team-profile-kicker">HOOPCHECK CLUB PROFILE</p><h1>{team.name}</h1><p className="hc-team-profile-meta">{team.country||t("international")}{team.city?" · "+team.city:""} · {team.league_name||t("professional")}</p></div></div><div className="actions"><FollowButton targetType="team" targetId={team.id} variant="club"/>{canReview&&<Link href={"/womens/"+team.id+"/review"} className="btn">{t("writeAReview")}</Link>}</div><ClaimedTeamLogoEditor teamId={team.id} teamName={team.name} teamTable="womens_teams" onSaved={(logoUrl, logoBg) => setTeam((current:any) => current ? { ...current, logo_url: logoUrl, logo_bg: logoBg } : current)} /></Surface>
 <section className="grid compact-grid">
    {["premium","player","member"].includes(reviewTier) ? <Surface className="card"><span className="card-kicker">{t("rating")}</span><h2>{average===null?"—":average.toFixed(1)+"/5"}</h2><p className="muted">{formatNumber(ratingCount)+" "+(ratingCount===1?t("publishedReview"):t("publishedReviews"))}</p></Surface> : reviewTier === "pro" ? <Surface className="card hc-fan-review-teaser"><span className="card-kicker">{t("rating")}</span><h2 aria-label="Overall star rating">★★★★★</h2><p className="muted">Limited rating preview</p><Link href="/membership" className="btn">Upgrade</Link></Surface> : <Surface className="card hc-membership-locked-state"><span aria-hidden="true">🔒</span><h2>Full player reviews require an eligible membership</h2><Link href="/membership" className="btn">Upgrade</Link></Surface>}
    <Surface className="card"><span className="card-kicker">{t("league")}</span><h2>{team.league_name||t("professional")}</h2><p className="muted">{team.country||t("international")}</p></Surface>
  </section>
  <Surface as="section" className="dashboard-card compact-section">
    {reviewTier === "pro" ? <><p className="eyebrow">{t("playerExperiences")}</p><h2>{t("ratingsReviews")}</h2><p className="hc-review-star-row">★★★★★ {average===null?"":average.toFixed(1)+"/5"}</p><p>Players and other eligible active members can access full reviews and ratings. Fan access depends on the active plan.</p><div className="hc-review-category-teaser">{["Communication","Professionalism","Development","Payment"].map(label=><div className="hc-review-category-row" key={label}><span>{label}</span><span className="hc-review-score-blur" aria-label="Score available with Fan Premium">★★★★★</span></div>)}</div><Link href="/membership" className="btn">Upgrade</Link></>
    : canViewReviews ? <><p className="eyebrow">{t("playerExperiences")}</p><h2>{t("ratingsReviews")}</h2>{reviews.map(r=><article className="compact-review" key={r.id}><div className="review-line"><strong>{r.title||t("playerExperience")}</strong><strong>{Number(r.overall_rating).toFixed(1)}/5</strong></div><p>{r.body}</p><small className="muted">{formatDate(r.created_at)}</small></article>)}{!reviews.length&&<p className="muted">{t("noPublishedReviewsYet")}</p>}</>
    : <><p className="eyebrow">{t("membership")}</p><h2>Full player reviews require an eligible membership</h2><p>Players and other eligible active members can access full reviews. Fan access depends on the active plan.</p><Link href="/membership" className="btn">Upgrade</Link></>}
  </Surface>
  <div className="bottom-back"><button type="button" className="btn dark" onClick={()=>window.history.back()}>← {t("back")}</button></div></div></main>;
}