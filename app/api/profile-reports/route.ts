import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest){
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token) return NextResponse.json({error:"Authentication required"},{status:401});
 const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:"Bearer "+token}}});
 const {data:{user}}=await supabase.auth.getUser(token);
 if(!user) return NextResponse.json({error:"Invalid session"},{status:401});
 const body=await req.json().catch(()=>({}));
 const profileId=typeof body.profileId==="string"?body.profileId:null;
 const reason=typeof body.reason==="string"?body.reason.trim().slice(0,500):"";
 if(!profileId||!reason) return NextResponse.json({error:"Profile and reason are required."},{status:400});
 if(profileId===user.id) return NextResponse.json({error:"You cannot report your own profile."},{status:400});
 const {error}=await supabase.from("profile_reports").insert({profile_id:profileId,reporter_id:user.id,reason});
 if(error) return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({ok:true});
}