"use client";

import { useEffect,useState } from "react";
import { supabase } from "../lib/supabase";
import { FAN_XP_PER_CORRECT_PICK,FAN_XP_WINDOW_DAYS } from "../lib/fan-prediction-xp";

type Summary={xp:number;level:string;next_level:string|null;next_level_xp:number|null;correct_picks:number;settled_picks:number;window_days:number};

export default function FanPredictionXp({accountId}:{accountId:string}){
  const [summary,setSummary]=useState<Summary|null>(null);
  const [loading,setLoading]=useState(true);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setSummary(null);setLoading(true);
    async function load(){
      try{
        const {data:{session}}=await supabase.auth.getSession();
        if(!active||session?.user.id!==accountId)return;
        const response=await fetch("/api/game-predictions?mode=fan-xp",{
          headers:{Authorization:"Bearer "+session.access_token},cache:"no-store",signal:controller.signal
        });
        if(!response.ok)return;
        const data=await response.json() as Summary;
        if(active&&typeof data.xp==="number"&&Number.isFinite(data.xp))setSummary(data);
      }catch{/* Report unavailable rather than displaying invented points. */}
      finally{if(active)setLoading(false);}
    }
    void load();
    return()=>{active=false;controller.abort();};
  },[accountId,attempt]);
  return <section className="dashboard-card" aria-label="Fan prediction XP">
    <p className="eyebrow">FAN LOYALTY · PREDICTION XP</p>
    <h2>{summary?summary.level:"Your fan activity"}</h2>
    <p className="muted">Earn {FAN_XP_PER_CORRECT_PICK} activity XP for each correct, settled pregame pick submitted in the last {FAN_XP_WINDOW_DAYS} days. XP is non-redeemable, has no cash value, and does not change membership access.</p>
    {loading?<p role="status">Loading your XP…</p>:summary?<div>
      <strong>{summary.xp} XP</strong><p>{summary.correct_picks} correct / {summary.settled_picks} settled picks</p>
      {summary.next_level_xp!==null&&<><progress aria-label="XP toward next level" value={summary.xp} max={summary.next_level_xp} style={{width:"100%"}}/><p className="muted">{summary.next_level_xp-summary.xp} XP to {summary.next_level}</p></>}
      {summary.next_level_xp===null&&<p className="muted">Highest activity level reached.</p>}
    </div>:<p role="status">Fan XP is temporarily unavailable.</p>}
    <button type="button" className="btn" disabled={loading} onClick={()=>setAttempt(n=>n+1)}>Refresh XP</button>
  </section>;
}
