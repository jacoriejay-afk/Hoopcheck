import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";


function stripeIdentityModeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const deploymentMode = process.env.VERCEL_ENV === "production" ? "live" : "test";
  const expectedPrefix = deploymentMode === "live" ? "sk_live_" : "sk_test_";
  return key.startsWith(expectedPrefix);
}

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
  if(!stripeIdentityModeConfigured())return NextResponse.json({error:"Identity verification is temporarily unavailable while payment configuration is verified."},{status:503});

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
  const origin=process.env.VERCEL_ENV === "production" ? "https://hoopcheck.online" : (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);

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

  // Persist the server-side ownership record before pointing the profile at
  // this session. If either write fails, never leave a profile referencing a
  // session that the ownership registry does not know about.
  const {error:sessionSaveError}=await admin.from("identity_verification_sessions").upsert({
    user_id:user.id,
    stripe_session_id:session.id,
    status:session.status||"requires_input",
    updated_at:new Date().toISOString()
  },{onConflict:"stripe_session_id"});

  if(sessionSaveError){
    console.error("Identity session save failed:",sessionSaveError);
    return NextResponse.json({error:"Verification was created but HoopCheck could not save the verification session. Please contact support."},{status:500});
  }

  const {error:profileUpdateError}=await admin.from("profiles").update({
    stripe_identity_verification_session_id:session.id,
    identity_verification_status:session.status==="verified"?"verified":"requires_input"
  }).eq("id",user.id);

  if(profileUpdateError){
    console.error("Identity profile update failed:",profileUpdateError);
    return NextResponse.json({error:"Verification was created but HoopCheck could not save the verification state. Please contact support."},{status:500});
  }

  return NextResponse.json({url:session.url,client_secret:session.client_secret,status:session.status});
}

export async function GET(req:Request){
  const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
  if(!token)return NextResponse.json({error:"Authentication required"},{status:401});
  if(!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:"Identity verification is not configured yet."},{status:503});
  if(!stripeIdentityModeConfigured())return NextResponse.json({error:"Identity verification is temporarily unavailable while payment configuration is verified."},{status:503});

  const supabase=getSupabase(token);
  const {data:{user},error:userError}=await supabase.auth.getUser(token);
  if(userError||!user)return NextResponse.json({error:"Invalid session"},{status:401});

  const {data:profile,error:profileLookupError}=await supabase.from("profiles")
    .select("account_type,stripe_identity_verification_session_id")
    .eq("id",user.id).maybeSingle();

  if(profileLookupError){
    console.error("Identity profile lookup failed:",profileLookupError);
    return NextResponse.json({error:"Unable to check your identity verification right now."},{status:500});
  }
  if(!profile || !["player","coach"].includes(profile.account_type || ""))
    return NextResponse.json({error:"Only player and coach accounts can check identity verification."},{status:403});
  if(!profile.stripe_identity_verification_session_id)
    return NextResponse.json({status:"not_started",verified:false});

  // Never trust a session ID stored on the profile by itself. Confirm that the
  // server-side session registry binds this exact Stripe session to this user.
  const admin=getAdminSupabase();
  const {data:savedSession,error:savedSessionError}=await admin
    .from("identity_verification_sessions")
    .select("user_id")
    .eq("stripe_session_id",profile.stripe_identity_verification_session_id)
    .maybeSingle();
  if(savedSessionError){
    console.error("Identity session ownership lookup failed:",savedSessionError);
    return NextResponse.json({error:"Unable to verify identity session ownership."},{status:500});
  }
  if(!savedSession || savedSession.user_id!==user.id){
    console.error("Identity session owner mismatch for user:",user.id);
    return NextResponse.json({error:"Identity verification session does not belong to this account."},{status:403});
  }

  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  let session:Stripe.Identity.VerificationSession;
  try{
    session=await stripe.identity.verificationSessions.retrieve(profile.stripe_identity_verification_session_id);
  }catch(error){
    console.error("Stripe Identity status lookup failed:",error);
    return NextResponse.json({error:"Unable to check your identity verification right now."},{status:502});
  }

  // Bind the Stripe object itself to the authenticated account and its role,
  // even if the local profile pointer or session registry is inconsistent.
  if(
    session.client_reference_id!==user.id ||
    session.metadata?.user_id!==user.id ||
    session.metadata?.hoopcheck_role!==profile.account_type
  ){
    console.error("Stripe Identity session metadata owner mismatch for user:",user.id);
    return NextResponse.json({error:"Identity verification session does not match this account."},{status:403});
  }

  const status=session.status||"requires_input";
  const verified=status==="verified";

  const {error:profileError}=await admin.from("profiles").update({
    identity_verification_status:verified?"verified":status,
    ...(verified && profile.account_type==="player" ? {player_verified:true,player_verified_at:new Date().toISOString()} : {}),
    ...(verified && profile.account_type==="coach" ? {coach_verified:true,coach_verified_at:new Date().toISOString()} : {})
  }).eq("id",user.id);

  if(profileError){
    console.error("Identity status profile update failed:",profileError);
    return NextResponse.json({error:"Verification completed but HoopCheck could not update your player badge."},{status:500});
  }

  const {error:sessionUpdateError}=await admin.from("identity_verification_sessions").update({
    status,
    updated_at:new Date().toISOString(),
    completed_at:verified?new Date().toISOString():null
  }).eq("stripe_session_id",session.id).eq("user_id",user.id);

  if(sessionUpdateError){
    console.error("Identity session status update failed:",sessionUpdateError);
    return NextResponse.json({error:"Verification status was checked but HoopCheck could not save the session status."},{status:500});
  }

  return NextResponse.json({status,verified});
}
