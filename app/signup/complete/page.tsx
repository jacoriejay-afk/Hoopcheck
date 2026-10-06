"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Complete(){
 const params=useSearchParams(); const email=params.get("email");
 return <main className="page-shell"><div className="page-container" style={{maxWidth:760,margin:"0 auto",padding:"70px 20px"}}>
  <section className="hero-card"><p className="eyebrow">WELCOME TO HOOPCHECK</p><h1>Account created.</h1>
  <p className="muted" style={{fontSize:17,lineHeight:1.7}}>Your next step is to confirm your email{email ? " at " + email : ""}. Then sign in and finish your profile.</p>
  <div className="result-grid" style={{marginTop:24}}>
   <div className="dashboard-card"><span className="card-kicker">01 · VERIFY</span><h2>Confirm your email</h2><p className="muted">Open the confirmation email from HoopCheck and verify your account.</p></div>
   <div className="dashboard-card"><span className="card-kicker">02 · PROFILE</span><h2>Customize your experience</h2><p className="muted">Add your background, interests, location, bio, and profile photo.</p></div>
   <div className="dashboard-card"><span className="card-kicker">03 · EXPLORE</span><h2>Start researching</h2><p className="muted">Search coaches, teams, leagues, and player profiles. Upgrade when you want full research access.</p></div>
  </div>
  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:24}}><Link href="/login" className="btn">Sign In</Link><Link href="/search" className="btn dark">Explore Search</Link></div>
 </section></div></main>;
}
export default function SignupCompletePage(){return <Suspense fallback={<main className="page-shell"><div className="page-container">Loading...</div></main>}><Complete/></Suspense>}
