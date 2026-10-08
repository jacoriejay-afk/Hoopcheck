"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function AnalyticsTracker(){
 const pathname=usePathname();
 useEffect(()=>{
   let active=true;
   (async()=>{
     const {data:{session}}=await supabase.auth.getSession();
     const user=session?.user;
     if(!active||!user)return;
     await supabase.rpc("touch_last_seen");
     await supabase.from("analytics_events").insert({user_id:user.id,event_name:"page_view",path:pathname,metadata:{source:"web"}});
   })();
   return()=>{active=false;};
 },[pathname]);
 return null;
}
