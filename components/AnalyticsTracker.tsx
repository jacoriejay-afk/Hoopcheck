"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getCachedSession, supabase } from "../lib/supabase";

export default function AnalyticsTracker(){
 const pathname=usePathname();
 useEffect(()=>{
   let active=true;
   const timer = window.setTimeout(() => (async()=>{
     const {data:{session}}=await getCachedSession();
     const user=session?.user;
     if(!active||!user)return;
     await supabase.rpc("touch_last_seen");
     await supabase.from("analytics_events").insert({user_id:user.id,event_name:"page_view",path:pathname,metadata:{source:"web"}});
   })(), 1200);
   return()=>{active=false;window.clearTimeout(timer);};
 },[pathname]);
 return null;
}
