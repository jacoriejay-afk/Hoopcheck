"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type FollowedPlayer = {
  player_id: string; display_name: string | null; avatar_url: string | null;
  current_team: string | null; current_country: string | null; followed_at: string;
  notify_team_changes: boolean;
};

export default function PlayersIFollow() {
  const [rows,setRows]=useState<FollowedPlayer[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const load=useCallback(async()=>{
    const {data,error}=await supabase.rpc("get_fan_career_following");
    if(error) setMessage("Your followed-player list is temporarily unavailable.");
    else setRows((data||[]) as FollowedPlayer[]);
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);
  async function unfollow(playerId:string){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {error}=await supabase.from("fan_player_career_follows").delete().eq("fan_id",user.id).eq("player_id",playerId);
    if(error){setMessage("Unable to unfollow this player. Please try again.");return;}
    setRows(v=>v.filter(x=>x.player_id!==playerId));
  }
  async function toggleAlerts(row:FollowedPlayer){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const next=!row.notify_team_changes;
    const {error}=await supabase.from("fan_player_career_follows").update({notify_team_changes:next}).eq("fan_id",user.id).eq("player_id",row.player_id);
    if(!error)setRows(v=>v.map(x=>x.player_id===row.player_id?{...x,notify_team_changes:next}:x));
  }
  return <section className="dashboard-card" style={{marginTop:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><span className="card-kicker">CAREER TRACKER</span><h2 style={{margin:"4px 0"}}>Players I Follow</h2><p className="muted" style={{margin:0}}>Track directory team changes—not player HoopFeed posts.</p></div>
      <Link href="/players" className="btn">Find players</Link>
    </div>
    {loading ? <p className="muted">Loading followed players…</p> : rows.length ? <div style={{display:"grid",gap:10,marginTop:14}}>
      {rows.map(row=><article key={row.player_id} style={{display:"flex",alignItems:"center",gap:12,padding:12,border:"1px solid var(--border)",borderRadius:12,flexWrap:"wrap"}}>
        {row.avatar_url ? <img src={row.avatar_url} alt="" style={{width:42,height:42,borderRadius:"50%",objectFit:"cover"}}/> : <span aria-hidden="true" style={{width:42,height:42,borderRadius:"50%",display:"grid",placeItems:"center",background:"var(--surface-muted)",fontWeight:800}}>{(row.display_name||"P").slice(0,1).toUpperCase()}</span>}
        <div style={{minWidth:0,flex:1}}><Link href={"/players/"+row.player_id} style={{fontWeight:800}}>{row.display_name||"HoopCheck Player"}</Link><p className="muted" style={{margin:"3px 0 0",fontSize:13}}>{row.current_team||"No current team listed"}{row.current_country?" · "+row.current_country:""}</p></div>
        <button type="button" className="btn" onClick={()=>void toggleAlerts(row)}>{row.notify_team_changes?"Alerts on":"Alerts off"}</button>
        <button type="button" className="btn dark" onClick={()=>void unfollow(row.player_id)}>Unfollow</button>
      </article>)}
    </div> : <p className="muted" style={{marginTop:14}}>You aren't following any players yet. Follow a player from their directory profile to track their career.</p>}
    {message&&<p className="muted" role="status">{message}</p>}
  </section>;
}
