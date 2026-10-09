import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function POST(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,""); if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
 const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user}}=await s.auth.getUser(token);
 if(!user)return NextResponse.json({error:"Invalid session"},{status:401});
 if(!user.email_confirmed_at)return NextResponse.json({error:"Please confirm your email address before submitting a review."},{status:403});

 const { count: recentCount } = await s
   .from("reviews")
   .select("id", { count: "exact", head: true })
   .eq("author_id", user.id)
   .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
 if ((recentCount ?? 0) >= 5) {
   return NextResponse.json({error:"Review limit reached. You can submit up to 5 reviews in a 24-hour period."},{status:429});
 }
 const b=await req.json().catch(()=>({}));
 const { data: subscription } = await s.from("subscriptions").select("status,current_period_end").eq("user_id", user.id).maybeSingle();
 const paid = (subscription?.status === "active" || subscription?.status === "trialing") && (!subscription?.current_period_end || new Date(subscription.current_period_end) > new Date());
 const { data: authorProfile } = await s.from("profiles").select("account_type,player_verified,basketball_type").eq("id", user.id).maybeSingle();
 if (authorProfile?.account_type !== "player" || authorProfile?.player_verified !== true) return NextResponse.json({error:"Only verified professional player accounts can submit ratings or reviews. Scouts, agents, and fans can research but cannot post."},{status:403});
 if (!paid) return NextResponse.json({error:"An active HoopCheck membership is required to submit ratings or reviews."},{status:403});
 const anonymous = b.is_anonymous === true; const targetKeys=["coach_id","team_id","league_id"].filter(k=>typeof b[k]==="string"&&b[k]);
 if(targetKeys.length!==1)return NextResponse.json({error:"Choose exactly one coach, team, or league."},{status:400});
 if (typeof b.team_id === "string" && b.team_id) {
   const { data: canReview, error: eligibilityError } = await s.rpc("can_user_review_team", { p_user_id: user.id, p_team_id: b.team_id });
   if (eligibilityError || canReview !== true) return NextResponse.json({error:"Only verified professional players who currently or previously played for this team can submit a team review."},{status:403});
 }
 const ratings=["overall_rating","communication_rating","professionalism_rating","development_rating","payment_rating"];
 for(const k of ratings){if(!Number.isFinite(Number(b[k]))||Number(b[k])<1||Number(b[k])>5)return NextResponse.json({error:`${k} must be between 1 and 5.`},{status:400});}
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
 const payload:any={author_id:user.id,coach_id:b.coach_id??null,team_id:b.team_id??null,league_id:b.league_id??null,player_season:playerSeason,overall_rating:Number(b.overall_rating),communication_rating:Number(b.communication_rating),professionalism_rating:Number(b.professionalism_rating),development_rating:Number(b.development_rating),payment_rating:Number(b.payment_rating),title:title||null,body,is_anonymous:anonymous,status:"pending"};
 const {data,error}=await s.from("reviews").insert(payload).select("id,status,created_at").single();
 if(error)return NextResponse.json({error:error.message},{status:error.code==="42501"?403:400}); return NextResponse.json(data,{status:201});
}
