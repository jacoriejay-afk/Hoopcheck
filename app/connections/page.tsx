"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import PlayerContactButton from "../../components/PlayerContactButton";
import {VerifiedBadge} from "../../components/HoopCheckUI";
type FollowRow={id:string|null;target_type:string;target_id:string;display_name:string|null;avatar_url:string|null;account_type:string|null;player_verified:boolean};
export default function ConnectionsPage(){
 const [userId,setUserId]=useState("");const [accountType,setAccountType]=useState("");const [loading,setLoading]=useState(true);const [listMode,setListMode]=useState("");const [listTitle,setListTitle]=useState("");const [rows,setRows]=useState<FollowRow[]>([]);const [listError,setListError]=useState("");
 useEffect(()=>{let live=true;(async()=>{
  const params=new URLSearchParams(window.location.search);
  const mode=params.get("mode")==="following"?"following":params.get("mode")==="followers"?"followers":"";
  const {data:{session}}=await supabase.auth.getSession();
  const currentUser=session?.user;
  if(!mode&&!currentUser){window.location.replace("/login?next=/connections");return;}
  const profileResult=currentUser?await supabase.from("profiles").select("account_type").eq("id",currentUser.id).maybeSingle():{data:null};
  if(live){
   setUserId(currentUser?.id||"");setAccountType(profileResult.data?.account_type||"");setListMode(mode);
   if(mode){
    setListTitle(mode==="following"?"Following":"Followers");
    const targetId=params.get("id");
    if(mode==="followers"&&!targetId)setListError("A profile or team is required to view followers.");
    else{
     const targetType = params.get("type") || (profileResult.data?.account_type === "fan" ? "fan" : "player");
     const {data:rows,error}=await supabase.rpc("get_public_follow_list",{p_mode:mode,p_target_type:mode==="followers"?targetType:null,p_target_id:mode==="followers"?targetId:null,p_user_id:mode==="following"?(params.get("id")||currentUser?.id):null});
     if(error)setListError("Connections could not be loaded. Please try again.");
     else setRows(((rows||[]) as FollowRow[]).filter(row => profileResult.data?.account_type !== "fan" || ["fan","team"].includes(row.target_type)));
    }
   }
   setLoading(false);
  }
 })();return()=>{live=false};},[]);
 if(loading)return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading connections…"/></div></main>;
 if(listMode)return <main className="page-shell"><div className="page-container"><header className="hero-card"><p className="eyebrow">{accountType==="fan"?"FAN NETWORK":"HOOPCHECK NETWORK"}</p><h1>{listTitle}</h1><p className="muted">{accountType==="fan"?"Teams and fans in your HoopCheck network.":"Real connections from the HoopCheck follow graph. Private profiles are not listed."}</p></header>{listError?<div className="state-card error">{listError}</div>:rows.length===0?<div className="state-card"><h2>No public connections yet</h2><p className="muted">Only real, visible follow relationships appear here.</p></div>:<section className="hc-connection-list">{rows.map((row,index)=>{const href=row.target_type==="team"?"/teams/"+row.target_id:row.target_type==="fan"?"/fans/"+(row.id||row.target_id):"/players/"+(row.id||row.target_id);const canOpen = row.target_type==="team" || row.target_type==="fan" || (accountType!=="fan" && row.target_type==="player" && row.account_type==="player");const content=<>{row.avatar_url?<img src={row.avatar_url} alt=""/>:<span className="hc-connection-avatar">{(row.display_name||"HC").slice(0,1).toUpperCase()}</span>}<span className="hc-connection-copy"><strong>{row.display_name||"HoopCheck member"} {accountType!=="fan"&&row.player_verified&&<VerifiedBadge label="Verified player"/>}</strong><small>{row.target_type==="team"?"Team":row.target_type==="fan"||row.account_type==="fan"?"Fan":"Player"}</small></span>{canOpen&&<span className="hc-connection-arrow">›</span>}</>;return canOpen?<Link className="hc-connection-row" href={href} key={row.id||row.target_id||index}>{content}</Link>:<div className="hc-connection-row" key={row.id||row.target_id||index}>{content}</div>;})}</section>}<p><Link href="/connections">Back to connections</Link></p></div></main>;
 return <main className="page-shell"><div className="page-container"><header className="hero-card"><p className="eyebrow">{accountType==="fan"?"FAN NETWORK":"HOOPCHECK NETWORK"}</p><h1>CONNECTIONS</h1><p className="muted">{accountType==="fan"?"Manage the teams and people you follow on HoopCheck.":"Manage the basketball connections and outreach tools attached to your account."}</p></header>{accountType==="player"?<section className="dashboard-card" style={{marginTop:18}}><h2>Recruiting and contact requests</h2><p className="muted">Review and respond to requests from scouts and agents.</p><PlayerContactButton playerId={userId}/></section>:["scout","agent"].includes(accountType)?<section className="dashboard-card" style={{marginTop:18}}><h2>Find players</h2><p className="muted">Discover player profiles and send outreach through their profile pages.</p><Link className="btn" href="/players">Browse players</Link></section>:<section className="dashboard-card" style={{marginTop:18}}><h2>{accountType==="fan"?"Your HoopCheck network":"Player connections"}</h2><p className="muted">{accountType==="fan"?"Follow teams and other fans to keep up with their activity.":"Player connection tools are available to eligible player, scout, and agent accounts."}</p><Link className="btn" href={accountType==="fan"?"/fan-feed":"/directory"}>{accountType==="fan"?"Open Fan HoopFeed":"Explore directory"}</Link></section>}<p style={{marginTop:18}}><Link href="/account">Back to Account</Link></p></div></main>;
}
