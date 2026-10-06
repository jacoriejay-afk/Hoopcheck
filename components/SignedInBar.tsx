"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "./GlobalSearch";
import { supabase } from "../lib/supabase";

export default function SignedInBar(){
 const [signedIn,setSignedIn]=useState(false);
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setSignedIn(!!data.session)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSignedIn(!!s)); return()=>data.subscription.unsubscribe();},[]);
 if(!signedIn) return null;
 return <div className="signed-in-bar">
  <Link href="/dashboard" className="brand mini-brand">HOOPCHECK</Link>
  <div className="signed-in-search"><GlobalSearch compact /></div>
  <nav className="signed-in-options">
   <Link href="/search">Search</Link><Link href="/account">Profile</Link><Link href="/settings">Settings</Link><NotificationBell/>
  </nav>
 </div>;
}
