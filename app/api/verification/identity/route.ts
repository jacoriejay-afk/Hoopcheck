import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getSupabase(token:string){
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {global:{headers:{Authorization:`Bearer ${token}`}}}
  );
}

function getAdminSupabase(){
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {auth:{autoRefreshToken:false,persistSession:false}}
  );
}

export async function POST(req:Request){
  const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
  if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
  if(!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:"Identity verification is not configured yet."},{status:503});

  const supabase=getSupabase(token);
  const {data:{user},error:userError}=await supabase.auth.getUser(token);
  if(userError||!user)return NextResponse.json({error:"Invalid session"},{status:401});

  const {data:profile}=await supabase.from("profiles").select("account_type,first_name,last_name,identity_verification_status").eq("id",user.id).maybeSingle();
  if(profile?.account_type!=="player")return NextResponse.json({error:"Only player accounts can start identity verification."},{status:403});
  if(profile.identity_verification_status==="verified")return NextResponse.json({error:"This player is already identity verified."},{status:409});

  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin=process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const session=await stripe.identity.verificationSessions.create({
    type:"document",
    client_reference_id:user.id,
    metadata:{user_id:user.id,hoopcheck_role:"player"},
    return_url:`${origin}/verification?identity=complete`,
    options:{document:{require_matching_selfie:true}}
  });

  const admin=getAdminSupabase();
  await admin.from("profiles").update({
    stripe_identity_verification_session_id:session.id,
    identity_verification_status:session.status==="verified"?"verified":"requires_input"
  }).eq("id",user.id);
  await admin.from("identity_verification_sessions").upsert({
    user_id:user.id,stripe_session_id:session.id,status:session.status||"requires_input",updated_at:new Date().toISOString()
  },{onConflict:"stripe_session_id"});

  return NextResponse.json({url:session.url,client_secret:session.client_secret,status:session.status});
}
