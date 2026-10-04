import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function POST(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,""); if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
 const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}});
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
 const b=await req.json().catch(()=>({})); const targetKeys=["coach_id","team_id","league_id"].filter(k=>typeof b[k]==="string"&&b[k]);
 if(targetKeys.length!==1)return NextResponse.json({error:"Choose exactly one coach, team, or league."},{status:400});
 const ratings=["overall_rating","communication_rating","professionalism_rating","development_rating","payment_rating"];
 for(const k of ratings){if(!Number.isFinite(Number(b[k]))||Number(b[k])<1||Number(b[k])>5)return NextResponse.json({error:`${k} must be between 1 and 5.`},{status:400});}
 const body=typeof b.body==="string"?b.body.trim():""; if(!body)return NextResponse.json({error:"Review text is required."},{status:400});
 const payload:any={author_id:user.id,coach_id:b.coach_id??null,team_id:b.team_id??null,league_id:b.league_id??null,overall_rating:Number(b.overall_rating),communication_rating:Number(b.communication_rating),professionalism_rating:Number(b.professionalism_rating),development_rating:Number(b.development_rating),payment_rating:Number(b.payment_rating),title:typeof b.title==="string"?b.title.trim()||null:null,body,status:"pending"};
 const {data,error}=await s.from("reviews").insert(payload).select("id,status,created_at").single();
 if(error)return NextResponse.json({error:error.message},{status:error.code==="42501"?403:400}); return NextResponse.json(data,{status:201});
}
