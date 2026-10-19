import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function POST(req:Request){
 const contentLength = Number(req.headers.get("content-length") ?? "0");
 if (Number.isFinite(contentLength) && contentLength > 16_384) {
   return NextResponse.json({error:"Review request is too large."},{status:413});
 }
 let b: Record<string, unknown>;
 try {
   const rawBody = await req.text();
   if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
     return NextResponse.json({error:"Review request is too large."},{status:413});
   }
   b = JSON.parse(rawBody);
   if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error("Invalid body");
 } catch {
   return NextResponse.json({error:"Invalid review request body."},{status:400});
 }
 const token=req.headers.get("authorization")?.replace(/^Bearer /,""); if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
 const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user}}=await s.auth.getUser(token);
 if(!user)return NextResponse.json({error:"Invalid session"},{status:401});
 if(!user.email_confirmed_at)return NextResponse.json({error:"Please confirm your email address before submitting a review."},{status:403});

 // The database RPC serializes claims per user, preventing concurrent requests
 // from bypassing the rolling 24-hour limit.
 const { data: subscription, error: subscriptionError } = await s.from("subscriptions").select("status,current_period_end").eq("user_id", user.id).maybeSingle();
 if (subscriptionError) {
   console.error("Review subscription lookup failed:", subscriptionError);
   return NextResponse.json({error:"Unable to verify your membership right now."},{status:500});
 }
 const paid = (subscription?.status === "active" || subscription?.status === "trialing") && (!subscription?.current_period_end || new Date(subscription.current_period_end) > new Date());
 const { data: authorProfile, error: profileError } = await s.from("profiles").select("account_type,player_verified,basketball_type").eq("id", user.id).maybeSingle();
 if (profileError) {
   console.error("Review author profile lookup failed:", profileError);
   return NextResponse.json({error:"Unable to verify your player account right now."},{status:500});
 }
 if (authorProfile?.account_type !== "player" || authorProfile?.player_verified !== true) return NextResponse.json({error:"Only verified professional player accounts can submit ratings or reviews. Scouts, agents, and fans can research but cannot post."},{status:403});
 if (!paid) return NextResponse.json({error:"An active HoopCheck membership is required to submit ratings or reviews."},{status:403});
 const anonymous = b.is_anonymous === true; const targetKeys=["coach_id","team_id","league_id"].filter(k=>typeof b[k]==="string"&&b[k]);
 if(targetKeys.length!==1)return NextResponse.json({error:"Choose exactly one coach, team, or league."},{status:400});
 if (typeof b.team_id === "string" && b.team_id) {
   const { data: canReview, error: eligibilityError } = await s.rpc("can_user_review_team", { p_user_id: user.id, p_team_id: b.team_id });
   if (eligibilityError || canReview !== true) return NextResponse.json({error:"Only verified professional players who currently or previously played for this team can submit a team review."},{status:403});
 }
 const categoryKeys=["pay_on_time_rating","housing_rating","medical_support_rating","communication_rating","coaching_quality_rating","facilities_rating","playing_time_honesty_rating"];
 // communication_rating is shared by the legacy and seven-category forms;
 // only the newer form-specific fields should switch validation modes.
 const hasAnyCategory=["pay_on_time_rating","housing_rating","medical_support_rating","coaching_quality_rating","facilities_rating","playing_time_honesty_rating"].some(k=>b[k]!==undefined&&b[k]!==null);
 const hasAllCategories=categoryKeys.every(k=>Number.isFinite(Number(b[k]))&&Number(b[k])>=1&&Number(b[k])<=5);
 if(hasAnyCategory&&!hasAllCategories)return NextResponse.json({error:"Please rate all seven signing categories from 1 to 5."},{status:400});
 if(!hasAnyCategory){
   const legacyRatings=["overall_rating","communication_rating","professionalism_rating","development_rating","payment_rating"];
   for(const k of legacyRatings){if(!Number.isFinite(Number(b[k]))||Number(b[k])<1||Number(b[k])>5)return NextResponse.json({error:`${k} must be between 1 and 5.`},{status:400});}
 }
 const categoryOverall=hasAllCategories
   ? Number((categoryKeys.reduce((sum,k)=>sum+Number(b[k]),0)/categoryKeys.length).toFixed(2))
   : Number(b.overall_rating);
 const body=typeof b.body==="string"?b.body.trim():"";
 const title=typeof b.title==="string"?b.title.trim():"";
 const prohibited=/\b(?:porn|xxx|sexcam)\b/i;
 if(prohibited.test(body)||prohibited.test(title)) return NextResponse.json({error:"Review contains prohibited language or explicit content."},{status:400});
 if(!body)return NextResponse.json({error:"Review text is required."},{status:400});
 if(body.length<10)return NextResponse.json({error:"Review text must be at least 10 characters."},{status:400});
 if(body.length>5000)return NextResponse.json({error:"Review text must be 5,000 characters or fewer."},{status:400});
 if(title.length>120)return NextResponse.json({error:"Review title must be 120 characters or fewer."},{status:400});
 const playerSeason=typeof b.player_season==="string"?b.player_season.trim():"";
 if(!/^\d{4}(-\d{2,4})?$/.test(playerSeason))return NextResponse.json({error:"Select the season you played for this team."},{status:400});
 const payload:any={
   author_id:user.id,coach_id:b.coach_id??null,team_id:b.team_id??null,league_id:b.league_id??null,
   player_season:playerSeason,overall_rating:categoryOverall,
   communication_rating:Number(b.communication_rating),
   professionalism_rating:b.professionalism_rating==null?null:Number(b.professionalism_rating),
   development_rating:b.development_rating==null?null:Number(b.development_rating),
   payment_rating:b.payment_rating==null?(b.pay_on_time_rating==null?null:Number(b.pay_on_time_rating)):Number(b.payment_rating),
   pay_on_time_rating:hasAllCategories?Number(b.pay_on_time_rating):null,
   housing_rating:hasAllCategories?Number(b.housing_rating):null,
   medical_support_rating:hasAllCategories?Number(b.medical_support_rating):null,
   coaching_quality_rating:hasAllCategories?Number(b.coaching_quality_rating):null,
   facilities_rating:hasAllCategories?Number(b.facilities_rating):null,
   playing_time_honesty_rating:hasAllCategories?Number(b.playing_time_honesty_rating):null,
   title:title||null,body,is_anonymous:anonymous,status:"pending"
 };
 const { data: hasReviewSlot, error: slotError } = await s.rpc("claim_review_submission_slot");
 if (slotError) {
   console.error("Atomic review rate-limit claim failed:", slotError);
   return NextResponse.json({error:"Unable to submit your review right now."},{status:500});
 }
 if (hasReviewSlot !== true) {
   return NextResponse.json({error:"Review limit reached. You can submit up to 5 reviews in a 24-hour period."},{status:429});
 }
 const {data,error}=await s.from("reviews").insert(payload).select("id,status,created_at").single();
 if(error){
   console.error("Review submission failed:", { code: error.code, message: error.message });
   return NextResponse.json({error:"Unable to submit review. Please check your entries and try again."},{status:error.code==="42501"?403:400});
 }
 return NextResponse.json(data,{status:201});
}
