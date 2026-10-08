"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";

export default function ProfilePage(){
 const [p,setP]=useState<any>(null);const [email,setEmail]=useState("");const [loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();const user=session?.user;if(!user){setLoading(false);return}setEmail(user.email||"");const result=await Promise.race([supabase.from("profiles").select("id,display_name,username,first_name,last_name,account_type,bio,position,years_pro,current_country,current_team,player_verified,coach_verified,avatar_url,basketball_type,free_agent,hometown,nationality,interests,favorite_leagues,profile_visibility").eq("id",user.id).maybeSingle(),new Promise<any>(resolve=>setTimeout(()=>resolve({data:null}),2500))]);setP(result.data);setLoading(false)})()},[]);
 if(loading)return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading your profile..." /></div></main>;
 if(!p)return <main className="page-shell"><div className="page-container"><section className="hero-card"><h1>Profile unavailable</h1><Link href="/account" className="btn">Edit Account</Link></section></div></main>;
 const name=p.display_name||p.username||"HoopCheck Member";
 return <main className="page-shell"><div className="page-container"><section className="hero-card compact-hero"><div style={{display:"flex",gap:14,alignItems:"center"}}>{p.avatar_url?<img src={p.avatar_url} alt="" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover",border:"2px solid var(--orange)"}}/>:<div className="player-avatar-fallback">HC</div>}<div><p className="eyebrow">MY PROFILE</p><h1>{name}{p.player_verified&&<span style={{color:"var(--orange)"}}> ✓</span>}</h1><p className="muted">{email}</p></div></div><div className="actions"><Link href="/account" className="btn">Edit Profile</Link>{p.account_type==="player"&&<Link href={"/players/"+p.id} className="btn dark">View Public Player Profile</Link>}</div></section>
 <section className="grid compact-grid"><div className="card"><span className="card-kicker">BASKETBALL</span><h2>{p.basketball_type==="womens"?"Women’s Basketball":"Men’s Basketball"}</h2><p className="muted">{p.account_type}</p></div>{p.account_type==="player"&&<div className="card"><span className="card-kicker">CAREER</span><h2>{p.position||"Position not listed"}</h2><p className="muted">{p.years_pro==null?"Years pro not listed":p.years_pro+" years pro"} · {p.free_agent?"Free Agent":p.current_team||"Team not listed"}</p></div>}<div className="card"><span className="card-kicker">LOCATION</span><h2>{p.current_country||"Not listed"}</h2><p className="muted">{p.hometown||p.nationality||"Location details not listed"}</p></div></section>
 <section className="dashboard-card compact-section"><p className="eyebrow">ABOUT</p><h2>Profile details</h2><p className="muted">{p.bio||"Add a bio from Edit Profile."}</p>{p.interests&&<p><strong>Interests:</strong> {p.interests}</p>}{p.favorite_leagues&&<p><strong>Favorite leagues:</strong> {p.favorite_leagues}</p>}</section>
 <div className="bottom-back"><button type="button" className="btn dark" onClick={()=>window.history.back()}>← Back</button></div></div></main>
}
