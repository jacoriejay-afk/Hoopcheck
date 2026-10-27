"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {supabase} from "../../../lib/supabase";
import FollowButton from "../../../components/FollowButton";
import FanConnectionButton from "../../../components/FanConnectionButton";
import BlockUserAction from "../../../components/BlockUserAction";
import HoopLoading from "../../../components/HoopLoading";

export default function FanProfilePage(){
 const params=useParams<{id:string}>(); const [fan,setFan]=useState<any>(null); const [loading,setLoading]=useState(true); const [blockedByViewer,setBlockedByViewer]=useState(false);
 useEffect(()=>{if(!params.id)return;(async()=>{const {data}=await supabase.from("profiles").select("id,display_name,username,avatar_url,bio").eq("id",params.id).eq("account_type","fan").maybeSingle();setFan(data);setLoading(false)})();},[params.id]);
 useEffect(()=>{let active=true;void(async()=>{if(!fan?.id)return;const {data:{user}}=await supabase.auth.getUser();if(!user||user.id===fan.id){if(active)setBlockedByViewer(false);return;}const {data}=await supabase.from("user_blocks").select("id").eq("blocker_id",user.id).eq("blocked_id",fan.id).maybeSingle();if(active)setBlockedByViewer(!!data)})();return()=>{active=false}},[fan?.id]);
 if(loading)return <main className="page-shell hc-fan-profile-page"><div className="page-container"><HoopLoading label="Loading fan profile..." /></div></main>;
 if(!fan)return <main className="page-shell"><div className="page-container"><section className="hero-card"><h1>Fan profile unavailable</h1><Link href="/fans" className="btn">Back to Fans</Link></section></div></main>;
 if(blockedByViewer)return <main className="page-shell"><div className="page-container"><section className="hero-card"><p className="eyebrow">BLOCKED PROFILE</p><h1>You have blocked this fan</h1><p className="muted">This profile and its content are hidden while the block is active.</p><BlockUserAction userId={fan.id} onChange={setBlockedByViewer}/></section></div></main>;
 return <main className="page-shell"><div className="page-container"><section className="player-profile-hero"><div className="player-profile-avatar">{fan.avatar_url?<img src={fan.avatar_url} alt=""/>:"F"}</div><div className="player-profile-heading"><p className="eyebrow">FAN PROFILE</p><h1>{fan.display_name||fan.username||"HoopCheck Fan"}</h1><p className="muted">@{fan.username||"fan"}</p></div></section><section className="dashboard-card" style={{marginTop:14}}><p>{fan.bio||"This fan has not added a public bio yet."}</p><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}><FollowButton targetType="fan" targetId={fan.id}/><FanConnectionButton fanId={fan.id}/><BlockUserAction userId={fan.id}/></div></section><div className="bottom-back"><button type="button" className="btn dark" onClick={()=>window.history.back()}>← Back</button></div></div></main>;
}