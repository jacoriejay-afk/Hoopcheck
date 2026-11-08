"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "./GlobalSearch";
import { getCachedSession, supabase } from "../lib/supabase";

export default function SignedInBar(){
 const [signedIn,setSignedIn]=useState(false); const [menuOpen,setMenuOpen]=useState(false); const [profileHref,setProfileHref]=useState("/profile"); const [accountType,setAccountType]=useState(""); const [roleReady,setRoleReady]=useState(false);
 useEffect(()=>{let active=true;const sync=async(session:any)=>{if(!active)return;setSignedIn(!!session);setRoleReady(!!session);if(!session?.user){if(active){setAccountType("");setProfileHref("/profile");setRoleReady(true);}return;}let p: {account_type?:string|null}|null=null;try {const result=await supabase.from("profiles").select("account_type").eq("id",session.user.id).maybeSingle();p=result.data;} catch(error){console.error("Unable to load header profile:",error);}if(active){setAccountType(p?.account_type||"");setProfileHref(p?.account_type==="player"?`/players/${session.user.id}`:p?.account_type==="fan"?"/account":"/profile");setRoleReady(true);}};void getCachedSession().then(({data})=>sync(data.session)).catch(error=>console.error("Unable to restore header session:",error));const {data}=supabase.auth.onAuthStateChange((_e,s)=>{setTimeout(()=>{if(active)void sync(s);},0);});return()=>{active=false;data.subscription.unsubscribe();};},[]);
 if(!signedIn || !roleReady)return null;
 return <div className="signed-in-bar">
  <Link href="/dashboard" className="brand mini-brand" aria-label="HoopCheck home">HOOPCHECK</Link>
  <div className="signed-in-search"><GlobalSearch compact fanView={accountType==="fan"} /></div>
  <nav className="signed-in-options">
   <Link href="/search">Search</Link><Link href={profileHref}>Profile</Link><NotificationBell/>
   <div className="global-menu">
    <button type="button" className="global-menu-toggle" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><span className="menu-icon">☰</span><span>Menu</span></button>
    {menuOpen&&<div className="global-menu-panel" onMouseLeave={()=>setMenuOpen(false)}>
      <Link href="/dashboard" onClick={()=>setMenuOpen(false)}>Dashboard</Link>
      <Link href="/search" onClick={()=>setMenuOpen(false)}>Search</Link>
      <Link href="/teams" onClick={()=>setMenuOpen(false)}>Teams</Link>
      <Link href="/womens" onClick={()=>setMenuOpen(false)}>Women’s Teams</Link>
      <Link href="/leagues" onClick={()=>setMenuOpen(false)}>Leagues</Link>
      {accountType === "fan" ? <><Link href="/fans" onClick={()=>setMenuOpen(false)}>Fans</Link><Link href="/team-hub" onClick={()=>setMenuOpen(false)}>Team Hub</Link><Link href="/fan-feed" onClick={()=>setMenuOpen(false)}>Fan HoopFeed</Link></> : <><Link href="/players" onClick={()=>setMenuOpen(false)}>Players</Link><Link href="/feed" onClick={()=>setMenuOpen(false)}>Community Feed</Link></>}
      <Link href={profileHref} onClick={()=>setMenuOpen(false)}>Profile</Link>
      <Link href="/settings" onClick={()=>setMenuOpen(false)}>Settings</Link>
      <Link href="/support" onClick={()=>setMenuOpen(false)}>Help & Support</Link>
      {accountType === "admin" && <Link href="/admin/directory" onClick={()=>setMenuOpen(false)}>Admin</Link>}
    </div>}
   </div>
  </nav>
 </div>;
}
