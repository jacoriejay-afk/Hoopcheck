"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";
import {VerifiedBadge} from "../../components/HoopCheckUI";
type FollowRow={id:string|null;target_type:string;target_id:string;display_name:string|null;avatar_url:string|null;account_type:string|null;player_verified:boolean};
type UserResult={id:string;display_name:string|null;username:string|null;avatar_url:string|null;account_type?:string|null;current_team?:string|null;player_verified?:boolean};
export default function ConnectionsPage(){
 const [userId,setUserId]=useState("");const [accountType,setAccountType]=useState("");const [loading,setLoading]=useState(true);const [listMode,setListMode]=useState("");const [listTitle,setListTitle]=useState("");const [rows,setRows]=useState<FollowRow[]>([]);const [listError,setListError]=useState("");
 const [query,setQuery]=useState("");const [people,setPeople]=useState<UserResult[]>([]);
 const [searching,setSearching]=useState(false);const [searchError,setSearchError]=useState("");
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
 useEffect(()=>{
  if(loading||listMode)return;
  let active=true;
  const term=query.trim().slice(0,80);
  if(term.length<2){setPeople([]);setSearching(false);setSearchError("");return;}
  setSearching(true);setSearchError("");
  const handle=window.setTimeout(async()=>{
   try{
    if(accountType==="fan"){
     // Fan discovery follows the same RLS-backed public profile query as /fans.
     const {data,error}=await supabase.from("profiles").select("id,display_name,username,avatar_url,account_type")
       .eq("account_type","fan").order("display_name").limit(100);
     if(error)throw error;
     const found=((data||[]) as UserResult[]).filter(p=>p.id!==userId&&
       [p.display_name,p.username].some(v=>v?.toLowerCase().includes(term.toLowerCase()))).slice(0,30);
     if(active)setPeople(found);
    }else{
     // This public search RPC enforces profile visibility; never query private player columns.
     const {data,error}=await supabase.rpc("search_public_players_page",{
      p_query:term,p_country:"",p_position:"",p_verified_only:false,p_limit:30,p_offset:0
     });
     if(error)throw error;
     if(active)setPeople(((data||[]) as UserResult[]).filter(p=>p.id!==userId));
    }
   }catch(e){console.error("People search failed",e);if(active){setPeople([]);setSearchError("Unable to search people. Please retry.");}}
   finally{if(active)setSearching(false);}
  },300);
  return()=>{active=false;window.clearTimeout(handle);};
 },[query,loading,listMode,accountType,userId]);
 if(loading)return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading connections…"/></div></main>;
 if(listMode)return <main className="page-shell"><div className="page-container"><header className="hero-card"><p className="eyebrow">{accountType==="fan"?"FAN NETWORK":"HOOPCHECK NETWORK"}</p><h1>{listTitle}</h1><p className="muted">{accountType==="fan"?"Teams and fans in your HoopCheck network.":"Real connections from the HoopCheck follow graph. Private profiles are not listed."}</p></header>{listError?<div className="state-card error">{listError}</div>:rows.length===0?<div className="state-card"><h2>No public connections yet</h2><p className="muted">Only real, visible follow relationships appear here.</p></div>:<section className="hc-connection-list">{rows.map((row,index)=>{const href=row.target_type==="team"?"/teams/"+row.target_id:row.target_type==="fan"?"/fans/"+(row.id||row.target_id):"/players/"+(row.id||row.target_id);const canOpen = row.target_type==="team" || row.target_type==="fan" || (accountType!=="fan" && row.target_type==="player" && row.account_type==="player");const content=<>{row.avatar_url?<img src={row.avatar_url} alt=""/>:<span className="hc-connection-avatar">{(row.display_name||"HC").slice(0,1).toUpperCase()}</span>}<span className="hc-connection-copy"><strong>{row.display_name||"HoopCheck member"} {accountType!=="fan"&&row.player_verified&&<VerifiedBadge label="Verified player"/>}</strong><small>{row.target_type==="team"?"Team":row.target_type==="fan"||row.account_type==="fan"?"Fan":"Player"}</small></span>{canOpen&&<span className="hc-connection-arrow">›</span>}</>;return canOpen?<Link className="hc-connection-row" href={href} key={row.id||row.target_id||index}>{content}</Link>:<div className="hc-connection-row" key={row.id||row.target_id||index}>{content}</div>;})}</section>}<p><Link href="/connections">Back to connections</Link></p></div></main>;
 return <main className="page-shell hc-people-search-page"><div className="page-container">
  <header className="hc-simple-page-heading"><h1>Find people</h1><p>Search HoopCheck members and open their profiles.</p></header>
  <div className="hc-people-search-bar">
   <label htmlFor="hc-people-query" className="visually-hidden">Search users</label>
   <input id="hc-people-query" type="search" value={query} autoComplete="off" maxLength={80}
    onChange={event=>setQuery(event.target.value)} placeholder={accountType==="fan"?"Search fans by name or username":"Search players by name or username"} />
   {query&&<button type="button" aria-label="Clear search" onClick={()=>setQuery("")}>×</button>}
  </div>
  <div className="hc-people-search-links">
   <Link href="/messages">Messages / HoopChat</Link>
   <Link href={accountType==="fan"?"/fans":"/search?type=players"}>Explore {accountType==="fan"?"fans":"players"}</Link>
  </div>
  {searchError&&<p role="alert" className="hc-people-search-error">{searchError}</p>}
  {searching&&<p role="status" className="hc-people-search-status">Searching…</p>}
  {!searching&&query.trim().length>=2&&!searchError&&people.length===0&&<p role="status" className="hc-people-search-status">No matching users.</p>}
  {!query.trim()&&<p className="hc-people-search-status">Start typing to find someone.</p>}
  <section className="hc-people-search-results" aria-label="User search results">
   {people.map(person=><Link key={person.id} href={accountType==="fan"?"/fans/"+encodeURIComponent(person.id):"/players/"+encodeURIComponent(person.id)} className="hc-people-search-person">
    <span className="hc-people-search-avatar">{person.avatar_url?<img src={person.avatar_url} alt="" />:(person.display_name||person.username||"HC").slice(0,1).toUpperCase()}</span>
    <span className="hc-people-search-person__info"><strong>{person.display_name||person.username||"HoopCheck member"} {person.player_verified&&<VerifiedBadge label="Verified player"/>}</strong>
    <small>{person.username?"@"+person.username:accountType==="fan"?"Fan":"Player"}{person.current_team?" · "+person.current_team:""}</small></span>
    <span aria-hidden="true">›</span>
   </Link>)}
  </section>
 </div></main>;
}
