import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params; const token=req.headers.get("authorization")?.replace(/^Bearer /,""); if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
 const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user}}=await s.auth.getUser(token); if(!user)return NextResponse.json({error:"Invalid session"},{status:401});
 const {data:admin}=await s.rpc("is_current_user_admin_or_moderator"); if(!admin)return NextResponse.json({error:"Admin or moderator access required"},{status:403});
 const b=await req.json().catch(()=>({})); const allowed=["pending","approved","rejected","flagged","removed"]; if(!allowed.includes(b.status))return NextResponse.json({error:"Invalid review status."},{status:400});
 const {data,error}=await s.from("reviews").update({status:b.status,updated_at:new Date().toISOString()}).eq("id",id).select("id,status").single();
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
}
