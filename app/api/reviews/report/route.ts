import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function POST(req:Request){
 const token=req.headers.get("authorization")?.replace(/^Bearer /,""); if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
 const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user}}=await s.auth.getUser(token); if(!user)return NextResponse.json({error:"Invalid session"},{status:401});
 const b=await req.json().catch(()=>({})); if(typeof b.review_id!=="string"||typeof b.reason!=="string"||!b.reason.trim())return NextResponse.json({error:"review_id and reason are required."},{status:400});
 const {data,error}=await s.from("review_reports").insert({review_id:b.review_id,reporter_id:user.id,reason:b.reason.trim(),status:"open"}).select("id,status,created_at").single();
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data,{status:201});
}
