"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "./GlobalSearch";
import { getCachedSession, supabase } from "../lib/supabase";

export default function SignedInBar(){
 const [signedIn,setSignedIn]=useState(false); const [menuOpen,setMenuOpen]=useState(false); const [profileHref,setProfileHref]=useState("/profile"); const [accountType,setAccountType]=useState("");
 useEffect(()=>{getCachedSession().then(async({data})=>{setSignedIn(!!data.session);if(data.session?.user){const {data:p}=await supabase.from("profiles").select("account_type").eq("id",data.session.user.id).maybeSingle();setAccountType(p?.account_type||"");if(p?.account_type==="player")setProfileHref(`/players/${data.session.user.id}`);else setProfileHref(p?.account_type==="fan"?"/account":"/profile");}});const {data}=supabase.auth.onAuthStateChange(async(_e,s)=>{setSignedIn(!!s);if(s?.user){const {data:p}=await supabase.from("profiles").select("account_type").eq("id",s.user.id).maybeSingle();setAccountType(p?.account_type||"");setProfileHref(p?.account_type==="player"?`/players/${s.user.id}`:p?.account_type==="fan"?"/account":"/profile");}else {setAccountType("");setProfileHref("/profile");}});return()=>data.subscription.unsubscribe();},[]);
 if(!signedIn)return null;
 return <div className="signed-in-bar">
  <Link href="/dashboard" className="brand mini-brand" aria-label="HoopCheck home">HOOPCHECK</Link>
  <div className="signed-in-search"><GlobalSearch compact /></div>
  <nav className="signed-in-options">
   <Link href="/search">Search</Link><Link href={profileHref}>Profile</Link><NotificationBell/>
   <div className="global-menu">
    <button type="button" className="global-menu-toggle" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><span className="menu-icon">☰</span><span>Menu</span></button>
    {menuOpen&&<div className="global-menu-panel" onMouseLeave={()=>setMenuOpen(false)}>
      <Link href="/dashboard" onClick={()=>setMenuOpen(false)}>Dashboard</Link>
      <Link href="/search" onClick={()=>setMenuOpen(false)}>Search</Link>
      <Link href="/teams" onClick={()=>setMenuOpen(false)}>Teams</Link>
      {accountType !== "fan" && <Link href="/players" onClick={()=>setMenuOpen(false)}>Players</Link>}
      <Link href="/leagues" onClick={()=>setMenuOpen(false)}>Leagues</Link>
      <Link href={accountType === "fan" ? "/fan-feed" : "/feed"} onClick={()=>setMenuOpen(false)}>{accountType === "fan" ? "Fan HoopFeed" : "Community Feed"}</Link>
      <Link href={profileHref} onClick={()=>setMenuOpen(false)}>Profile</Link>
      <Link href="/settings" onClick={()=>setMenuOpen(false)}>Settings</Link>
      <Link href="/support" onClick={()=>setMenuOpen(false)}>Help & Support</Link>
      <Link href="/admin/directory" onClick={()=>setMenuOpen(false)}>Admin</Link>
    </div>}
   </div>
  </nav>
 </div>;
}
