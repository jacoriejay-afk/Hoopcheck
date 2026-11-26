"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import CareerClaimIntake,{careerIntakeEnabled} from "../../components/CareerClaimIntake";
import {supabase} from "../../lib/supabase";
export default function CareerHistoryPage(){
 const [state,setState]=useState<{id:string;category:"mens"|"womens"}|null>(null),[message,setMessage]=useState("Loading career history…");
 useEffect(()=>{
  if(!careerIntakeEnabled)return;
  let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
   if(!session){setState(null);setMessage("Sign in to manage career history.");}
   else setState(previous=>previous&&previous.id!==session.user.id?null:previous);
  });
  void(async()=>{try{
   const {data:{user}}=await supabase.auth.getUser();
   if(!user){if(active)setMessage("Sign in to manage career history.");return;}
   const profile=await supabase.from("profiles").select("account_type,basketball_type").eq("id",user.id).maybeSingle();
   const {data:{session}}=await supabase.auth.getSession();
   if(!active||session?.user.id!==user.id)return;
   if(profile.error||profile.data?.account_type!=="player"){setMessage("Career history is available to player accounts.");return;}
   setState({id:user.id,category:profile.data.basketball_type==="womens"?"womens":"mens"});
  }catch{if(active)setMessage("Career history is unavailable. Try again later.");}})();
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 return <main className="page-shell"><div className="page-container"><Link href="/account">Back to account</Link><h1>Career history</h1>{!careerIntakeEnabled?<p>Career claims are not available yet.</p>:state?<CareerClaimIntake key={state.id} userId={state.id} initialCategory={state.category}/>:<p role="status">{message}</p>}</div></main>;
}
