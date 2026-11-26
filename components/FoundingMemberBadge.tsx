"use client";
import { useEffect,useState } from "react";
import { supabase } from "../lib/supabase";
import { readFoundingMember } from "../apps/mobile/src/native/foundingMember";
export default function FoundingMemberBadge({userId}:{userId:string}){
 const [owner,setOwner]=useState<string|null>(null);
 useEffect(()=>{
  if(process.env.NEXT_PUBLIC_HOOPCHECK_FOUNDING_MEMBER_ENABLED!=="true"||!userId)return;
  let active=true;const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(),8000);
  void (async()=>{
   try{const {data,error}=await supabase.auth.getSession();const session=data.session;if(error||session?.user.id!==userId||!active)return;
    const eligible=await readFoundingMember("/api/account/founding-member",session.access_token,abort.signal);
    const current=await supabase.auth.getSession();if(active&&!abort.signal.aborted&&!current.error&&current.data.session?.user.id===userId)setOwner(eligible?userId:null);
   }catch{}finally{clearTimeout(deadline);}
  })();
  const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user.id!==userId){active=false;abort.abort();setOwner(null);}});
  return()=>{active=false;abort.abort();clearTimeout(deadline);listener.subscription.unsubscribe();};
 },[userId]);
 return owner===userId?<span className="muted" title="Early account recognition, not professional verification or paid access">★ Founding Member · early supporter</span>:null;
}
