"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import PlayerContactButton from "../../components/PlayerContactButton";
export default function ConnectionsPage(){
 const [userId,setUserId]=useState("");const [accountType,setAccountType]=useState("");const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session?.user){window.location.replace("/login?next=/connections");return;}const {data}=await supabase.from("profiles").select("account_type").eq("id",session.user.id).maybeSingle();if(live){setUserId(session.user.id);setAccountType(data?.account_type||"");setLoading(false);}})();return()=>{live=false};},[]);
 if(loading)return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading connections…"/></div></main>;
 return <main className="page-shell"><div className="page-container"><header className="hero-card"><p className="eyebrow">PLAYER NETWORK</p><h1>CONNECTIONS</h1><p className="muted">Manage the basketball connections and outreach tools attached to your account.</p></header>{accountType==="player"?<section className="dashboard-card" style={{marginTop:18}}><h2>Recruiting and contact requests</h2><p className="muted">Review and respond to requests from scouts and agents.</p><PlayerContactButton playerId={userId}/></section>:["scout","agent"].includes(accountType)?<section className="dashboard-card" style={{marginTop:18}}><h2>Find players</h2><p className="muted">Discover player profiles and send outreach through their profile pages.</p><Link className="btn" href="/players">Browse players</Link></section>:<section className="dashboard-card" style={{marginTop:18}}><h2>Player connections</h2><p className="muted">Player connection tools are available to eligible player, scout, and agent accounts.</p></section>}<p style={{marginTop:18}}><Link href="/account">Back to Account</Link></p></div></main>;
}
