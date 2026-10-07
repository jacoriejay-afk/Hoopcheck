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

  const {data:profile}=await supabase.from("profiles")
    .select("account_type,identity_verification_status,coach_verified")
    .eq("id",user.id).maybeSingle();

  if(!profile || !["player","coach"].includes(profile.account_type || ""))
    return NextResponse.json({error:"Only player and coach accounts can start identity verification."},{status:403});
  if(profile.account_type==="coach"){
    const {data:sub}=await supabase.from("subscriptions").select("plan,status,current_period_end").eq("user_id",user.id).maybeSingle();
    const active=(sub?.status==="active"||sub?.status==="trialing") && (sub?.current_period_end==null || new Date(sub.current_period_end)>new Date());
    if(!active || !["pro","premium"].includes(sub?.plan||"")) return NextResponse.json({error:"Coach identity verification is available to active Pro and Premium coaches."},{status:403});
  }
  if(profile.identity_verification_status==="verified")
    return NextResponse.json({error:`This ${profile.account_type} is already identity verified.`},{status:409});

  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin=process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  let session:Stripe.Identity.VerificationSession;
  try{
    session=await stripe.identity.verificationSessions.create({
      type:"document",
      client_reference_id:user.id,
      metadata:{user_id:user.id,hoopcheck_role:profile.account_type},
      return_url:`${origin}/verification?identity=complete`,
      options:{document:{require_matching_selfie:true}}
    });
  }catch(error){
    console.error("Stripe Identity session creation failed:",error);
    return NextResponse.json({error:"We could not start the secure ID + face verification. Please try again."},{status:502});
  }

  const admin=getAdminSupabase();
  const {error:profileUpdateError}=await admin.from("profiles").update({
    stripe_identity_verification_session_id:session.id,
    identity_verification_status:session.status==="verified"?"verified":"requires_input"
  }).eq("id",user.id);

  if(profileUpdateError){
    console.error("Identity profile update failed:",profileUpdateError);
    return NextResponse.json({error:"Verification was created but HoopCheck could not save the verification state. Please contact support."},{status:500});
  }

  const {error:sessionSaveError}=await admin.from("identity_verification_sessions").upsert({
    user_id:user.id,
    stripe_session_id:session.id,
    status:session.status||"requires_input",
    updated_at:new Date().toISOString()
  },{onConflict:"stripe_session_id"});

  if(sessionSaveError){
    console.error("Identity session save failed:",sessionSaveError);
    return NextResponse.json({error:"Verification was created but HoopCheck could not save the verification session. Please try again."},{status:500});
  }

  return NextResponse.json({url:session.url,client_secret:session.client_secret,status:session.status});
}

export async function GET(req:Request){
  const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
  if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
  if(!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:"Identity verification is not configured yet."},{status:503});

  const supabase=getSupabase(token);
  const {data:{user},error:userError}=await supabase.auth.getUser(token);
  if(userError||!user)return NextResponse.json({error:"Invalid session"},{status:401});

  const {data:profile}=await supabase.from("profiles")
    .select("account_type,stripe_identity_verification_session_id")
    .eq("id",user.id).maybeSingle();

  if(!profile || !["player","coach"].includes(profile.account_type || ""))
    return NextResponse.json({error:"Only player and coach accounts can check identity verification."},{status:403});
  if(!profile.stripe_identity_verification_session_id)
    return NextResponse.json({status:"not_started",verified:false});

  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  let session:Stripe.Identity.VerificationSession;
  try{
    session=await stripe.identity.verificationSessions.retrieve(profile.stripe_identity_verification_session_id);
  }catch(error){
    console.error("Stripe Identity status lookup failed:",error);
    return NextResponse.json({error:"Unable to check your identity verification right now."},{status:502});
  }

  const status=session.status||"requires_input";
  const verified=status==="verified";
  const admin=getAdminSupabase();

  const {error:profileError}=await admin.from("profiles").update({
    identity_verification_status:verified?"verified":status,
    ...(verified && profile.account_type==="player" ? {player_verified:true,player_verified_at:new Date().toISOString()} : {}),
    ...(verified && profile.account_type==="coach" ? {coach_verified:true,coach_verified_at:new Date().toISOString()} : {})
  }).eq("id",user.id);

  if(profileError){
    console.error("Identity status profile update failed:",profileError);
    return NextResponse.json({error:"Verification completed but HoopCheck could not update your player badge."},{status:500});
  }

  await admin.from("identity_verification_sessions").update({
    status,
    updated_at:new Date().toISOString(),
    completed_at:verified?new Date().toISOString():null
  }).eq("stripe_session_id",session.id);

  return NextResponse.json({status,verified});
}
