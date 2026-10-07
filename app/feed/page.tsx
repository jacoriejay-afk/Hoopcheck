"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import HoopLoading from "../../components/HoopLoading";

type MiniProfile = { display_name: string | null; avatar_url: string | null; current_country?: string | null; current_team?: string | null };
type Post = { id:string; body:string; image_url:string|null; location_country:string|null; created_at:string; expires_at:string; author_id:string; ageLabel?:string; expiresLabel?:string; profiles?:MiniProfile|null };
type Comment = { id:string; post_id:string; body:string; created_at:string; author_id:string; profiles?:MiniProfile|null };
type Profile = { account_type:string; current_country:string|null };
type Subscription = { plan:string|null; status:string|null; access_status:string|null };

const ago = (v:string) => {
  const s=Math.max(0,Math.floor((now-new Date(v).getTime())/1000));
  if(s<60)return "just now"; const m=Math.floor(s/60); if(m<60)return m+"m ago";
  const h=Math.floor(m/60); if(h<24)return h+"h ago"; return Math.floor(h/24)+"d ago";
};

export default function Feed(){
  const [posts,setPosts]=useState<Post[]>([]);
  const [comments,setComments]=useState<Record<string,Comment[]>>({});
  const [checks,setChecks]=useState<Record<string,number>>({});
  const [mine,setMine]=useState<Record<string,boolean>>({});
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [open,setOpen]=useState<Record<string,boolean>>({});
  const [body,setBody]=useState(""); const [photo,setPhoto]=useState<File|null>(null); const [preview,setPreview]=useState(""); 
  const [user,setUser]=useState<any>(null); const [profile,setProfile]=useState<Profile|null>(null); const [subscription,setSubscription]=useState<Subscription|null>(null);
  const [msg,setMsg]=useState(""); const [loading,setLoading]=useState(true); const [posting,setPosting]=useState(false);

  const access=["player","fan","scout","agent"].includes(profile?.account_type||"") &&
    (subscription?.plan==="pro"||subscription?.plan==="premium") &&
    (subscription?.status==="active"||subscription?.status==="trialing") &&
    (subscription?.access_status==null||["active","trialing","pro","premium"].includes(subscription.access_status));

  async function load(){
    let followedTeamNames:string[]=[]; let followedFanIds:string[]=[]; let connectedPlayerIds:string[]=[];
    if(profile?.account_type==="player"){
      const {data:connections}=await supabase.from("player_contact_requests").select("requester_id,player_id").or(`requester_id.eq.${user?.id},player_id.eq.${user?.id}`).eq("status","accepted").limit(100);
      connectedPlayerIds=(connections||[]).flatMap((x:any)=>x.requester_id===user?.id?[x.player_id]:[x.requester_id]).filter(Boolean);
    }
    if(profile?.account_type==="fan"){
      const {data:follows}=await supabase.from("follow_relationships").select("target_id,target_type").eq("follower_id",user?.id).in("target_type",["fan","team"]).limit(100);
      const teamIds=(follows||[]).filter((x:any)=>x.target_type==="team").map((x:any)=>x.target_id).filter(Boolean);
      followedFanIds=(follows||[]).filter((x:any)=>x.target_type==="fan").map((x:any)=>x.target_id).filter(Boolean);
      if(teamIds.length){const {data:teams}=await supabase.from("teams").select("name").in("id",teamIds);followedTeamNames=(teams||[]).map((t:any)=>t.name).filter(Boolean);}
    }
    const {data,error}=await supabase.from("feed_posts")
      .select("id,body,image_url,location_country,created_at,expires_at,author_id,profiles(display_name,avatar_url,current_country,current_team)")
      .eq("status","approved").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(50);
    if(error){setMsg(error.message);return;}
    const now=Date.now();
    let rows=(data||[]).map((r:any)=>{const post={...r,profiles:Array.isArray(r.profiles)?(r.profiles[0]??null):(r.profiles??null)} as Post; return {...post,ageLabel:ago(post.created_at,now),expiresLabel:`Expires in ${Math.max(0,Math.ceil((new Date(post.expires_at).getTime()-now)/3600000))}h`};});
    if(profile?.account_type==="fan") rows=rows.filter(p=>followedFanIds.includes(p.author_id));
    if(profile?.account_type==="player") rows=rows.filter(p=>p.author_id===user?.id || connectedPlayerIds.includes(p.author_id));
    setPosts(rows);
    if(!rows.length){setComments({});setChecks({});setMine({});return;}
    const ids=rows.map(p=>p.id);
    const [{data:cs},{data:ks}]=await Promise.all([
      supabase.from("feed_post_comments").select("id,post_id,body,created_at,author_id,profiles(display_name,avatar_url)").in("post_id",ids).order("created_at",{ascending:true}),
      supabase.from("feed_post_checks").select("post_id,user_id").in("post_id",ids)
    ]);
    const cg:Record<string,Comment[]>={}; const cc:Record<string,number>={}; const cm:Record<string,boolean>={};
    (cs||[]).forEach((r:any)=>{(cg[r.post_id]??=[]).push({...r,profiles:Array.isArray(r.profiles)?(r.profiles[0]??null):(r.profiles??null)});});
    (ks||[]).forEach((r:any)=>{cc[r.post_id]=(cc[r.post_id]||0)+1;if(r.user_id===user?.id)cm[r.post_id]=true;});
    setComments(cg);setChecks(cc);setMine(cm);
  }

  useEffect(()=>{(async()=>{const {data:{user:u}}=await supabase.auth.getUser();setUser(u);if(!u){setLoading(false);return;}
    const [{data:p},{data:s}]=await Promise.all([
      supabase.from("profiles").select("account_type,current_country").eq("id",u.id).maybeSingle(),
      supabase.from("subscriptions").select("plan,status,access_status").eq("user_id",u.id).maybeSingle()
    ]);
    setProfile(p);setSubscription(s);if(p?.account_type==="player"&&(s?.plan==="pro"||s?.plan==="premium"))await load();setLoading(false);
  })();},[]);

  async function choosePhoto(f:File){
    if(!f.type.startsWith("image/")){setMsg("Choose a JPG, PNG, or WebP image.");return;}
    if(f.size>8*1024*1024){setMsg("Feed photos must be 8MB or smaller.");return;}
    try{
      const compressed=await new Promise<File>((resolve,reject)=>{
        const img=new Image(); const url=URL.createObjectURL(f);
        img.onload=()=>{URL.revokeObjectURL(url);const max=1600;const scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext("2d");if(!ctx){reject(new Error("Photo processing failed."));return;}ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(!blob){reject(new Error("Photo processing failed."));return;}resolve(new File([blob],"hoopfeed.jpg",{type:"image/jpeg"}));},"image/jpeg",0.82);};
        img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Photo could not be read."));}; img.src=url;
      });
      if(preview)URL.revokeObjectURL(preview);setPhoto(compressed);setPreview(URL.createObjectURL(compressed));setMsg("");
    }catch(e:any){setMsg(e?.message||"Photo processing failed.");}
  }
  function clearPhoto(){if(preview)URL.revokeObjectURL(preview);setPhoto(null);setPreview("");}

  async function post(){
    if(!user||!access||(!body.trim()&&!photo)||posting)return;
    setPosting(true);setMsg("Checking your post for safety...");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setMsg("Your session expired. Please sign in again.");setPosting(false);return;}
      const form=new FormData();
      form.append("kind","post");
      form.append("text",body.trim());
      if(photo)form.append("image",photo);
      const moderation=await fetch("/api/hoopfeed/moderate",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:form});
      const result=await moderation.json().catch(()=>({}));
      if(!moderation.ok||result.allowed!==true){setMsg(result.message||"This post could not be published because it did not pass HoopFeed safety checks.");setPosting(false);return;}
      setBody("");clearPhoto();setMsg("Posted to HoopFeed. AI safety checks passed. It stays live for 24 hours.");await load();
    }catch(e:any){setMsg(e?.message||"Safety check failed. Your content was not published.");}
    setPosting(false);
  }

  async function toggleCheck(p:Post){
    if(!user||!access)return;
    if(mine[p.id]){const {error}=await supabase.from("feed_post_checks").delete().eq("post_id",p.id).eq("user_id",user.id);if(error){setMsg(error.message);return;}setMine(x=>({...x,[p.id]:false}));setChecks(x=>({...x,[p.id]:Math.max(0,(x[p.id]||0)-1)}));}
    else{const {error}=await supabase.from("feed_post_checks").insert({post_id:p.id,user_id:user.id});if(error){setMsg(error.message);return;}setMine(x=>({...x,[p.id]:true}));setChecks(x=>({...x,[p.id]:(x[p.id]||0)+1}));}
  }

  async function comment(post_id:string){
    const text=(drafts[post_id]||"").trim();if(!user||!access||!text)return;
    setMsg("Checking comment...");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token){setMsg("Your session expired. Please sign in again.");return;}
      const form=new FormData();form.append("kind","comment");form.append("post_id",post_id);form.append("text",text);
      const moderation=await fetch("/api/hoopfeed/moderate",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},body:form});
      const result=await moderation.json().catch(()=>({}));
      if(!moderation.ok||result.allowed!==true){setMsg(result.message||"This comment did not pass HoopFeed safety checks.");return;}
      setDrafts(x=>({...x,[post_id]:""}));setMsg("");await load();
    }catch(e:any){setMsg(e?.message||"Comment safety check failed.");}
  }

  async function del(p:Post){if(!user||p.author_id!==user.id)return;if(!confirm("Delete this HoopFeed post?"))return;const {error}=await supabase.from("feed_posts").delete().eq("id",p.id);if(error){setMsg(error.message);return;}if(p.image_url){const marker="/storage/v1/object/public/feed-images/";const i=p.image_url.indexOf(marker);if(i>=0)await supabase.storage.from("feed-images").remove([p.image_url.slice(i+marker.length)]);}await load();}

  if(loading)return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading HoopFeed..." /></div></main>;
  if(!user)return <main className="page-shell"><div className="page-container"><section className="hero-card"><p className="eyebrow">HOOPFEED</p><h1>Sign in to continue</h1><p className="muted">HoopFeed is for active Pro and Premium members.</p><Link href="/login" className="btn">Sign In</Link></section></div></main>;
  if(!access)return <main className="page-shell"><div className="page-container"><header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link></header><section className="hero-card"><p className="eyebrow">HOOPFEED</p><h1>Daily Player Experiences</h1><p className="muted">Pro and Premium members can access HoopFeed. Players share basketball experiences; fans see posts from fans they follow.</p><div className="actions"><Link href="/membership" className="btn">Upgrade Membership</Link><Link href="/dashboard" className="btn dark">Back to Dashboard</Link></div></section></div></main>;

  return <main className="page-shell"><div className="page-container">
    <header className="topbar"><Link href="/dashboard" className="brand">HOOPCHECK</Link><nav className="topnav"><Link href="/players">Players</Link><Link href="/profile">Profile</Link></nav></header>
    <section className="hero-card"><p className="eyebrow">HOOPFEED · {subscription?.plan==="premium"?"PREMIUM":"PRO"}</p><h1>HoopFeed</h1><p className="muted">{profile?.account_type==="fan"?"Followed-fan activity, updated throughout the day.":"Share your current-season basketball life."} Posts, photos, checks and comments disappear with the post after 24 hours.</p></section>

    {(profile?.account_type==="player" || profile?.account_type==="fan") && <section className="dashboard-card" style={{marginTop:18}}><span className="card-kicker">SHARE TO HOOPFEED</span>
      <textarea value={body} onChange={e=>setBody(e.target.value)} rows={4} maxLength={2000} placeholder={profile?.account_type==="fan"?"What are you watching, following, or talking about?":"What happened today? Practice, game day, travel, teammates, culture, wins, challenges..."} />
      {preview&&<div style={{marginTop:12}}><img src={preview} alt="Post preview" style={{width:"100%",maxHeight:360,objectFit:"cover",borderRadius:16,display:"block"}}/><button type="button" className="btn dark" style={{marginTop:8}} onClick={clearPhoto}>Remove Photo</button></div>}
      <div style={{display:"flex",gap:10,marginTop:10,alignItems:"center",flexWrap:"wrap"}}><label htmlFor="hoopfeed-photo" className="btn dark" style={{cursor:"pointer"}}>Add Photo</label><input id="hoopfeed-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)choosePhoto(f)}} style={{display:"none"}}/><button className="btn" onClick={post} disabled={posting||(!body.trim()&&!photo)}>{posting?"Posting...":"Post to HoopFeed"}</button>{msg&&<span className="muted">{msg}</span>}</div>
    </section>}

    <section style={{display:"grid",gap:14,marginTop:18}}>{posts.length?posts.map(p=>{const cs=comments[p.id]||[];return <article className="dashboard-card" key={p.id}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><div style={{display:"flex",gap:12,alignItems:"center"}}>{p.profiles?.avatar_url?<img src={p.profiles.avatar_url} alt="" style={{width:46,height:46,borderRadius:"50%",objectFit:"cover"}}/>:<div className="player-avatar-fallback">HC</div>}<div><strong>{p.profiles?.display_name||"HoopCheck Player"}</strong>{p.location_country&&<div className="muted">📍 Playing in {p.location_country}</div>}<small className="muted">{p.ageLabel}</small></div></div>{p.author_id===user.id&&<button type="button" className="btn dark" onClick={()=>void del(p)}>Delete</button>}</div>
      {p.body.trim()&&<p style={{whiteSpace:"pre-wrap",marginTop:14}}>{p.body}</p>}{p.image_url&&<img src={p.image_url} alt="HoopFeed post" style={{width:"100%",maxHeight:520,objectFit:"cover",borderRadius:16,display:"block",marginTop:12}}/>}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}><button type="button" className={mine[p.id]?"btn":"btn dark"} onClick={()=>void toggleCheck(p)}>✓ {mine[p.id]?"Checked":"Check"} · {checks[p.id]||0}</button><button type="button" className="btn dark" onClick={()=>setOpen(x=>({...x,[p.id]:!x[p.id]}))}>Comment · {cs.length}</button><small className="muted" style={{alignSelf:"center"}}>{p.expiresLabel}</small></div>
      {open[p.id]&&<div style={{marginTop:14,borderTop:"1px solid var(--border)",paddingTop:14}}><div style={{display:"grid",gap:10}}>{cs.map(c=><div key={c.id} style={{display:"flex",gap:10}}>{c.profiles?.avatar_url?<img src={c.profiles.avatar_url} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div className="player-avatar-fallback" style={{width:34,height:34,minWidth:34}}>HC</div>}<div><strong>{c.profiles?.display_name||"Player"}</strong><div style={{whiteSpace:"pre-wrap"}}>{c.body}</div><small className="muted">{ago(c.created_at)}</small></div></div>)}{!cs.length&&<p className="muted">No comments yet.</p>}</div><div style={{display:"flex",gap:8,marginTop:12}}><input value={drafts[p.id]||""} onChange={e=>setDrafts(x=>({...x,[p.id]:e.target.value}))} maxLength={1000} placeholder="Add a comment..." /><button type="button" className="btn" disabled={!drafts[p.id]?.trim()} onClick={()=>void comment(p.id)}>Send</button></div></div>}
    </article>}) : <div className="dashboard-card"><h2>No active HoopFeed posts yet.</h2><p className="muted">Follow players in your current-season country to see their daily posts here.</p></div>}</section>
  </div></main>;
}
