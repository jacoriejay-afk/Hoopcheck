"use client";

import HoopLoading from "../../../components/HoopLoading";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import TeamLeaguePicker from "../../../components/TeamLeaguePicker";

type AccountType="player"|"coach"|"fan"|"scout"|"agent"|"manager";

const roleCopy:Record<AccountType,{title:string;description:string;goals:string[]}> = {
 player:{title:"Player Experience",description:"Research teams and coaches, manage your professional profile, verify your career, share first-hand experiences and connect with the basketball community.",goals:["Research a team before signing","Share professional experiences","Build a verified player profile","Connect with scouts and agents"]},
 coach:{title:"Coach Experience",description:"Build a coaching profile, research organizations, pursue verification and connect with professional players when eligible.",goals:["Build your coaching profile","Research teams and leagues","Pursue coach verification","Connect with players"]},
 manager:{title:"Team Manager Experience",description:"Claim your organization and manage official team updates after verification.",goals:["Claim your organization","Manage official updates","Connect with your community"]},
 scout:{title:"Scout Experience",description:"Create a research-first workspace for discovering players, teams and leagues around the world.",goals:["Discover players","Follow markets and leagues","Research teams","Connect with eligible players"]},
 agent:{title:"Agent Experience",description:"Create a recruiting-focused workspace for researching players, teams and leagues and building professional connections.",goals:["Research players","Track leagues and markets","Research teams","Connect with eligible players"]},
 fan:{title:"Fan Experience",description:"Follow the teams and basketball worlds you care about, with fan membership features designed around your interests.",goals:["Follow favorite teams","Track leagues","Explore global basketball","Unlock fan membership features"]}
};

function Complete(){
 const params=useSearchParams(); const router=useRouter(); const email=params.get("email");
 const [authChecked,setAuthChecked]=useState(false); const [hasAuthenticatedUser,setHasAuthenticatedUser]=useState(false);
 const [resendLoading,setResendLoading]=useState(false); const [authMessage,setAuthMessage]=useState("");
 const [accountType,setAccountType]=useState<AccountType>("player"); const [basketballType,setBasketballType]=useState<"mens"|"womens">("mens"); const [womenPlayer,setWomenPlayer]=useState(false);
 const [favoriteTeamName,setFavoriteTeamName]=useState("");
 const [goal,setGoal]=useState(""); const [preferences,setPreferences]=useState(""); const [saved,setSaved]=useState(false); const [saving,setSaving]=useState(false); const [saveError,setSaveError]=useState("");

 useEffect(()=>{let mounted=true;void(async()=>{try{const {data:{user}}=await supabase.auth.getUser();if(!mounted)return;if(!user){setAuthChecked(true);return;}setHasAuthenticatedUser(true);const metadata=(user.user_metadata?.account_type||"player") as AccountType;setAccountType(metadata);const femalePlayer=metadata==="player"&&(user.user_metadata?.gender==="female"||user.user_metadata?.basketball_type==="womens");setWomenPlayer(femalePlayer);setBasketballType(femalePlayer?"womens":(user.user_metadata?.basketball_type==="womens"?"womens":"mens"));setGoal(metadata==="player"?"research":metadata==="fan"?"follow_teams":"research");}catch(error){console.error("Signup completion setup failed:",error);}finally{if(mounted)setAuthChecked(true);}})();return()=>{mounted=false};},[]);

 async function resendConfirmation(){if(!email){setAuthMessage("Enter the email address you used to sign up, then try logging in or creating your account again.");return;}setResendLoading(true);setAuthMessage("");try{const {error}=await supabase.auth.resend({type:"signup",email});if(error)throw error;setAuthMessage("If this email needs confirmation, a fresh confirmation link has been sent. Check your inbox and spam folder.");}catch(error){setAuthMessage(error instanceof Error?error.message:"We couldn't resend the confirmation email. Please try again.");}finally{setResendLoading(false);}}
 const copy=roleCopy[accountType];
 async function save(){
  if(saving)return;
  setSaving(true);
  setSaveError("");
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError)throw authError;
   if(!user){router.push("/login?returnTo=/signup/complete");return;}
   const {data,error}=await supabase.from("profiles").update({account_type:accountType,basketball_type:accountType==="fan"||accountType==="player"?basketballType:null,favorite_teams:favoriteTeamName||null,experience_goal:goal,research_preferences:preferences.trim().slice(0,1000)||null}).eq("id",user.id).select("id").maybeSingle();
   if(error)throw error;
   if(!data)throw new Error("Your profile could not be updated. Please try again.");
   localStorage.setItem("hoopcheck_profile_setup","complete");
   setSaved(true);
   router.replace("/onboarding/teams");
  }catch(error){
   console.error("Signup profile completion failed:",error);
   setSaveError(error instanceof Error?error.message:"Your changes could not be saved. Please try again.");
  }finally{setSaving(false);}
 }
 if(!authChecked)return <main className="page-shell"><div className="page-container"><section className="hero-card"><p className="eyebrow">WELCOME TO HOOPCHECK</p><h1>Checking your account…</h1><p className="muted">We’re verifying your sign-in before continuing.</p></section></div></main>;
 if(!hasAuthenticatedUser)return <main className="page-shell"><div className="page-container"><section className="hero-card"><p className="eyebrow">ONE LAST STEP</p><h1>Check your email to finish signup.</h1><p className="muted">We received your signup request{email?<> for <strong>{email}</strong></>:null}. If email confirmation is enabled, open the confirmation link we sent you. Then return to HoopCheck and log in with the same email and password. If you don’t see the email, check spam or request another link below.</p><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}><button className="btn" onClick={resendConfirmation} disabled={resendLoading}>{resendLoading?"Sending…":"Resend Confirmation Email"}</button><Link href="/login" className="btn dark">Go to Login</Link><Link href="/signup" className="btn dark">Back to Sign Up</Link></div>{authMessage&&<p className="muted" role="status" aria-live="polite" style={{marginTop:16}}>{authMessage}</p>}<p className="muted" style={{marginTop:18}}>Already signed up with this email? Try logging in or use “Forgot password?” to recover access. You won’t be considered signed in until HoopCheck accepts your login.</p></section></div></main>;
 if(saved)return <main className="page-shell"><div className="page-container"><section className="hero-card"><p className="eyebrow">WELCOME TO HOOPCHECK</p><h1>Your experience is ready.</h1><p className="muted">Your {copy.title.toLowerCase()} has been personalized.</p><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}><Link href="/onboarding/teams" className="btn">Continue to team setup</Link><Link href="/teams" className="btn dark">Explore Teams</Link></div></section></div></main>;
 return <main className="page-shell"><div className="page-container signup-complete-shell">
  {saveError&&<p role="alert" className="hc-ux2b-error">{saveError}</p>}
  <section className="hero-card"><p className="eyebrow">WELCOME TO HOOPCHECK</p><h1>Let’s personalize your experience.</h1><p className="muted">Your account is created as a <strong>{copy.title.replace(" Experience","")}</strong>{email && <> for {email}</>}. Here is what HoopCheck will prioritize for you.</p></section>
  <section className="dashboard-card" style={{marginTop:12}}><p className="eyebrow">YOUR ACCOUNT</p><h2>{copy.title}</h2><p className="muted">{copy.description}</p><div className="grid" style={{padding:"14px 0 0"}}>{copy.goals.map((g,i)=><article className="card" key={g}><span className="card-kicker">0{i+1}</span><h3>{g}</h3></article>)}</div></section>
  {(accountType==="player"||accountType==="fan")&&<section className="dashboard-card" style={{marginTop:12}}><p className="eyebrow">BASKETBALL</p><h2>{womenPlayer?"Women’s HoopCheck":"Choose your basketball experience"}</h2>{womenPlayer?<p className="muted">Your female Player account is automatically placed in the Women’s HoopCheck category.</p>:<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}><button type="button" className={basketballType==="mens"?"btn":"btn dark"} onClick={()=>{setBasketballType("mens");setFavoriteTeamName("");}}>Men’s Basketball</button><button type="button" className={basketballType==="womens"?"btn":"btn dark"} onClick={()=>{setBasketballType("womens");setFavoriteTeamName("");}}>Women’s Basketball</button></div>}</section>}
  <section className="dashboard-card" style={{marginTop:18}}><p className="eyebrow">YOUR GOAL</p><h2>What do you want HoopCheck to help you do?</h2><select value={goal} onChange={e=>setGoal(e.target.value)}><option value="research">Research basketball opportunities</option>{accountType==="player"&&<><option value="share_experience">Share my professional experiences</option><option value="career_connections">Build career connections</option></>}{accountType==="coach"&&<option value="coaching_opportunities">Find coaching opportunities</option>}{accountType==="scout"&&<option value="discover_players">Discover players</option>}{accountType==="agent"&&<option value="recruit_players">Recruit and represent players</option>}{accountType==="fan"&&<option value="follow_teams">Follow my favorite teams</option>}</select>
  <label style={{display:"block",marginTop:14}}>What countries, leagues, teams, positions, or basketball interests should HoopCheck prioritize for you?<textarea value={preferences} onChange={e=>setPreferences(e.target.value)} rows={5} maxLength={1000} placeholder="Example: Portugal, Germany, guards, EuroCup, player development..." /></label></section>
  <section className="dashboard-card" style={{marginTop:18}}><p className="eyebrow">FOLLOW</p><h2>Choose a team to follow</h2><p className="muted">You can add more later.</p><TeamLeaguePicker mode="team" value={favoriteTeamName} returnValue="name" onChange={setFavoriteTeamName} basketballType={accountType==="player"||accountType==="fan"?basketballType:null} placeholder="Search teams by name, city or country" /></section>
  <section className="dashboard-card" style={{marginTop:18}}><p className="eyebrow">READY</p><button className="btn" onClick={save} disabled={saving}>{saving?"Saving...":"Save My Experience"}</button><p className="muted" style={{marginTop:10}}>You can change preferences later from your profile and settings.</p></section>
 </div></main>;
}
export default function SignupComplete(){return <Suspense fallback={<main className="page-shell"><div className="page-container"><HoopLoading label="Loading your personalized setup..." /></div></main>}><Complete/></Suspense>;}
